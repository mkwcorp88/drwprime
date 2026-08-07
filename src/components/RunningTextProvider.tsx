'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type RunningTextContextValue = {
  runningText: string;
  setRunningText: (text: string) => void;
};

const RunningTextContext = createContext<RunningTextContextValue | null>(null);

export function RunningTextProvider({
  children,
  initialText,
}: {
  children: ReactNode;
  initialText: string;
}) {
  const [runningText, setRunningText] = useState(initialText);

  useEffect(() => {
    setRunningText(initialText);
  }, [initialText]);

  return (
    <RunningTextContext.Provider value={{ runningText, setRunningText }}>
      {children}
    </RunningTextContext.Provider>
  );
}

export function useRunningText() {
  const context = useContext(RunningTextContext);
  if (!context) {
    throw new Error('useRunningText must be used within RunningTextProvider');
  }
  return context;
}
