import React, { createContext, useState, useContext, ReactNode, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAccount } from './AccountContext';
import { toast } from "@/components/ui/use-toast";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Interfaces (remain the same) ---
interface Job {
    id: string;
    accountId: string;
    listId: string;
    listName: string;
    status: 'running' | 'paused' | 'completed' | 'cancelled';
    progress: number;
    results: ImportResult[];
    totalContacts: number;
    elapsedTime: number;
    delay: number;
}

interface ImportResult {
    index: number;
    email: string;
    status: 'success' | 'failed';
    data: string;
}

interface JobContextType {
    jobs: Record<string, Job>;
    startJob: (accountId: string, listId: string, listName: string, importData: string, delay: number) => void;
    pauseJob: (jobId: string) => void;
    resumeJob: (jobId: string) => void;
    cancelJob: (jobId: string) => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

// --- Provider Component ---
export const JobProvider = ({ children }: { children: ReactNode }) => {
    const { accounts } = useAccount();
    const [jobs, setJobs] = useState<Record<string, Job>>({});
    const jobControlRefs = useRef<Record<string, { isPaused: boolean; isCancelled: boolean }>>({});

    // Timer effect (remains the same)
    useEffect(() => {
        const timer = setInterval(() => {
            setJobs(prevJobs => {
                const newJobs = { ...prevJobs };
                let hasChanged = false;
                for (const jobId in newJobs) {
                    // Only increment time if the job actually exists and is running
                    if (newJobs[jobId] && newJobs[jobId].status === 'running') {
                        newJobs[jobId] = { ...newJobs[jobId], elapsedTime: newJobs[jobId].elapsedTime + 1 };
                        hasChanged = true;
                    }
                }
                return hasChanged ? newJobs : prevJobs;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Helper to remove a job (remains the same, but called differently now)
    const removeJob = (jobId: string) => {
        setJobs(prev => {
            const newJobs = { ...prev };
            delete newJobs[jobId];
            return newJobs;
        });
        delete jobControlRefs.current[jobId];
    };

    // Helper to update job status in state
    const updateJobStatus = (jobId: string, status: Job['status']) => {
        setJobs(prev => {
            const currentJob = prev[jobId];
            // Only update if the job exists and status is changing
            if (currentJob && currentJob.status !== status) {
                 // Ensure progress is 100% if completing
                 const progress = status === 'completed' ? 100 : currentJob.progress;
                 return { ...prev, [jobId]: { ...currentJob, status, progress } };
            }
            return prev; // No change needed
        });
     };


    const startJob = useCallback(async (accountId: string, listId: string, listName: string, importData: string, delay: number) => {
        const account = accounts.find(acc => acc.id === accountId);
        if (!account) {
            toast({ title: "Account not found", variant: "destructive" });
            return;
        }

        const contacts = importData
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '')
            .map(line => { /* ... contact parsing logic ... */
                const parts = line.split(',');
                return {
                    email: parts[0]?.trim(),
                    firstName: parts[1]?.trim() || '',
                    lastName: parts[2]?.trim() || ''
                };
             })
            .filter(contact => contact.email);

        if (contacts.length === 0) {
            toast({ title: "No Valid Contacts", variant: "destructive" });
            return;
        }

        // *** FIX: Remove any existing finished/running job for this account BEFORE starting ***
        const existingJobId = Object.values(jobs).find(job => job.accountId === accountId)?.id;
        if (existingJobId) {
            console.log(`Removing previous job ${existingJobId} for account ${accountId}`);
            // Ensure any pending cancellation flags are cleared if removing directly
            if (jobControlRefs.current[existingJobId]) {
                 delete jobControlRefs.current[existingJobId];
            }
            // Use removeJob helper which also cleans up refs
            removeJob(existingJobId);
            // Give state a moment to update before adding new job
            await sleep(50);
        }
        // ********************************************************************************

        const jobId = uuidv4();
        jobControlRefs.current[jobId] = { isPaused: false, isCancelled: false };

        const newJob: Job = {
            id: jobId,
            accountId,
            listId: listId,
            listName: listName,
            status: 'running',
            progress: 0,
            results: [],
            totalContacts: contacts.length,
            elapsedTime: 0,
            delay,
        };

        setJobs(prev => ({ ...prev, [jobId]: newJob }));
        toast({ title: `Starting Job`, description: `Importing ${contacts.length} contacts to "${listName}".` });


        for (let i = 0; i < contacts.length; i++) {
            const controls = jobControlRefs.current[jobId];
             if (!controls) {
                console.warn(`Job ${jobId} controls not found, likely cancelled/removed.`);
                // Don't update status here, just break as the job no longer exists in state
                break;
            }

             // *** Check cancellation: Update status and break loop (DON'T remove job) ***
             if (controls.isCancelled) {
                toast({ title: `Job Cancelled`, description: `Import to "${listName}" stopped.` });
                updateJobStatus(jobId, 'cancelled'); // Update status in state
                delete jobControlRefs.current[jobId]; // Clean up controls ref
                break; // Exit loop
             }

             // Handle pausing
             while (controls.isPaused) {
                 if (controls.isCancelled) { // Check cancellation while paused
                     toast({ title: `Job Cancelled`, description: `Import to "${listName}" stopped while paused.` });
                     updateJobStatus(jobId, 'cancelled'); // Update status in state
                     delete jobControlRefs.current[jobId]; // Clean up controls ref
                     return; // Exit function entirely
                 }
                await sleep(500);
            }

            // *** Re-check cancellation after pause: Update status and break loop (DON'T remove job) ***
            if (jobControlRefs.current[jobId]?.isCancelled) {
                 toast({ title: `Job Cancelled`, description: `Import to "${listName}" stopped.` });
                 updateJobStatus(jobId, 'cancelled'); // Update status in state
                 delete jobControlRefs.current[jobId]; // Clean up controls ref
                 break; // Exit loop
            }

            const contact = contacts[i];

            if (i > 0 && delay > 0) {
                await sleep(delay * 1000);
            }

            // *** Re-check cancellation after delay: Update status and break loop (DON'T remove job) ***
            if (jobControlRefs.current[jobId]?.isCancelled) {
                 toast({ title: `Job Cancelled`, description: `Import to "${listName}" stopped.` });
                 updateJobStatus(jobId, 'cancelled'); // Update status in state
                 delete jobControlRefs.current[jobId]; // Clean up controls ref
                 break; // Exit loop
            }

            const brevoContactPayload = {
                email: contact.email,
                firstName: contact.firstName,
                lastName: contact.lastName
            };

            try {
                // ... (Fetch call and response handling remain the same) ...
                const response = await fetch('/api/brevo/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey: account.apiKey,
                        contact: brevoContactPayload,
                        listId: listId
                    })
                });
                const responseText = await response.text();
                let data;
                 try {
                   data = responseText ? JSON.parse(responseText) : { status: response.status };
                } catch(e) {
                   data = { rawResponse: responseText, status: response.status };
                }
                if (response.status !== 201 && response.status !== 204) throw data;


                setJobs(prev => {
                    const currentJob = prev[jobId];
                    if (!currentJob) return prev; // Avoid updates if job was cancelled/removed
                    const newResult: ImportResult = { index: i + 1, email: contact.email, status: 'success', data: JSON.stringify(data, null, 2) };
                    const updatedResults = [newResult, ...currentJob.results];
                    const newProgress = ((i + 1) / currentJob.totalContacts) * 100;
                    return {
                        ...prev,
                        [jobId]: { ...currentJob, results: updatedResults, progress: newProgress }
                    };
                });

            } catch (error: any) {
                console.error(`Failed importing ${contact.email}:`, error);
                setJobs(prev => {
                    const currentJob = prev[jobId];
                    if (!currentJob) return prev;
                    const errorDataString = typeof error === 'string' ? error : JSON.stringify(error, null, 2);
                    const newResult: ImportResult = { index: i + 1, email: contact.email, status: 'failed', data: errorDataString };
                    const updatedResults = [newResult, ...currentJob.results];
                    const newProgress = ((i + 1) / currentJob.totalContacts) * 100;
                    return {
                        ...prev,
                        [jobId]: { ...currentJob, results: updatedResults, progress: newProgress }
                    };
                });
            }
        } // End of loop

        // *** Update completion logic: Only update status, DON'T remove job ***
        // Check if the job wasn't cancelled during the loop
        if (jobControlRefs.current[jobId]) {
             toast({ title: `Job Completed`, description: `Finished importing to "${listName}".` });
             updateJobStatus(jobId, 'completed'); // Update status to completed
             delete jobControlRefs.current[jobId]; // Clean up controls ref
             // DO NOT call removeJob(jobId) here
        }

    }, [accounts, jobs]); // Added 'jobs' dependency for checking existing jobs

    // pauseJob, resumeJob remain the same
     const pauseJob = (jobId: string) => {
        if(jobControlRefs.current[jobId]) {
            jobControlRefs.current[jobId].isPaused = true;
            updateJobStatus(jobId, 'paused'); // Use helper function
            toast({ title: "Job Paused", description: `Job for "${jobs[jobId]?.listName}" paused.` });
        }
    };
    const resumeJob = (jobId: string) => {
        if(jobControlRefs.current[jobId]) {
            jobControlRefs.current[jobId].isPaused = false;
            updateJobStatus(jobId, 'running'); // Use helper function
            toast({ title: "Job Resumed", description: `Job for "${jobs[jobId]?.listName}" resumed.` });
        }
    };

     // cancelJob: Only sets the flag
     const cancelJob = (jobId: string) => {
        if(jobControlRefs.current[jobId]) {
            // Only set the flag, loop will handle state update and ref cleanup
            jobControlRefs.current[jobId].isCancelled = true;
            toast({ title: "Job Cancellation Requested", description: `Stopping job for "${jobs[jobId]?.listName}".`, variant: "destructive" });
        }
    };


    return (
        <JobContext.Provider value={{ jobs, startJob, pauseJob, resumeJob, cancelJob }}>
            {children}
        </JobContext.Provider>
    );
};

// Hook (remains the same)
export const useJobs = () => {
    // ... (code as before) ...
    const context = useContext(JobContext);
    if (context === undefined) {
        throw new Error('useJobs must be used within a JobProvider');
    }
    return context;
};