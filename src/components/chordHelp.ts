import { createContext, useContext } from 'react';

/** Opens the "how to play this chord" card for a chord name; `onClose` runs when the card is dismissed. Provided by App. */
export type ShowChordHelp = (chord: string, onClose?: () => void) => void;

export const ChordHelpContext = createContext<ShowChordHelp>(() => {});

export const useChordHelp = () => useContext(ChordHelpContext);
