import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';

// *** UPDATED INTERFACE (removed apiUrl) ***
interface Account {
  id: string;
  name: string;
  apiKey: string; // Represents the Brevo API Key
  status?: "unknown" | "checking" | "connected" | "failed";
  lastCheckResponse?: any;
}

// Omit id, status, lastCheckResponse for add/update data types
type AccountData = Omit<Account, 'id' | 'status' | 'lastCheckResponse'>;

interface AccountContextType {
  accounts: Account[];
  activeAccount: Account | null;
  setActiveAccount: (account: Account | null) => void;
  fetchAccounts: () => Promise<void>;
  addAccount: (accountData: AccountData) => Promise<void>; // Signature remains the same
  updateAccount: (id: string, data: AccountData) => Promise<void>; // Signature remains the same
  deleteAccount: (id: string) => Promise<void>;
  checkAccountStatus: (account: Account) => Promise<Account>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccountState] = useState<Account | null>(null);

  const setActiveAccount = (account: Account | null) => {
    // If setting an active account, ensure the main accounts list also reflects its latest state
    if (account) {
      setAccounts(prev => prev.map(a => a.id === account.id ? account : a));
    }
    setActiveAccountState(account);
  }

  // *** checkAccountStatus now validates against the backend which uses Brevo ***
  const checkAccountStatus = useCallback(async (account: Account): Promise<Account> => {
    // The backend endpoint '/api/accounts/check-status' now handles Brevo validation
    const response = await fetch('/api/accounts/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: account.apiKey }) // Send Brevo API Key
    });
    const result = await response.json(); // Backend returns { status: '...', response: {...} }

    // Use status directly from backend response
    const status: Account['status'] = result.status || (response.ok ? 'connected' : 'failed');

    return { ...account, status: status, lastCheckResponse: result.response || result }; // Store the actual response or error
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }
      let data: Account[] = await response.json(); // Interface now expects only id, name, apiKey

      // Filter out any potential malformed account data
      const validAccounts = data.filter(acc => acc && acc.id && acc.name && acc.apiKey);

      const accountsWithStatus = await Promise.all(validAccounts.map(acc => checkAccountStatus(acc)));

      setAccounts(accountsWithStatus);

      // Update active account logic (no change needed here)
      const currentActiveId = activeAccount?.id;
      if (accountsWithStatus.length > 0) {
          const newActiveAccount = currentActiveId
              ? accountsWithStatus.find(a => a.id === currentActiveId)
              : accountsWithStatus[0];
          setActiveAccountState(newActiveAccount || accountsWithStatus[0]);
      } else {
          setActiveAccountState(null);
      }

    } catch (error) {
      console.error("Failed to fetch accounts:", error);
      setAccounts([]);
      setActiveAccountState(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkAccountStatus]);

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // addAccount remains the same, expects AccountData { name, apiKey }
  const addAccount = async (accountData: AccountData) => {
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountData), // Contains name, apiKey (Brevo key)
    });
    await fetchAccounts();
  };

  // updateAccount remains the same, expects AccountData { name, apiKey }
  const updateAccount = async (id: string, data: AccountData) => {
    await fetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data), // Contains name, apiKey (Brevo key)
    });
    const accountToUpdate = accounts.find(acc => acc.id === id);
    if (accountToUpdate) {
        manualCheckAccountStatus({ ...accountToUpdate, ...data });
    }
  };

  // deleteAccount remains the same
  const deleteAccount = async (id: string) => {
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    const remainingAccounts = accounts.filter(acc => acc.id !== id);
    setAccounts(remainingAccounts);
    if (activeAccount?.id === id) {
        setActiveAccountState(remainingAccounts.length > 0 ? remainingAccounts[0] : null);
    }
  };

  // manualCheckAccountStatus remains the same functionally
  const manualCheckAccountStatus = async (account: Account) => {
    setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, status: 'checking' } : a));
    if (activeAccount?.id === account.id) {
      setActiveAccountState(prev => prev ? { ...prev, status: 'checking' } : null);
    }

    const updatedAccount = await checkAccountStatus(account); // Uses the Brevo check via backend

    setAccounts(prev => prev.map(a => a.id === account.id ? updatedAccount : a));
    if (activeAccount?.id === account.id) {
      setActiveAccountState(updatedAccount);
    }
    return updatedAccount;
  };

  return (
    <AccountContext.Provider value={{ accounts, activeAccount, setActiveAccount, fetchAccounts, addAccount, updateAccount, deleteAccount, checkAccountStatus: manualCheckAccountStatus }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};