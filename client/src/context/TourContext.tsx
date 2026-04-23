import { createContext, useContext, useState, type ReactNode } from 'react';

interface TourContextType {
  tourActive: boolean;
  tourStep: number;
  startTour: () => void;
  setTourStep: (step: number) => void;
  endTour: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  function startTour() {
    setTourActive(true);
    setTourStep(0);
  }

  function endTour() {
    setTourActive(false);
    setTourStep(0);
    localStorage.setItem('sr-tour-seen', '1');
  }

  return (
    <TourContext.Provider value={{ tourActive, tourStep, startTour, setTourStep, endTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
