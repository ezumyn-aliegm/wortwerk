import { createContext, useContext } from "react";
export const TutorContext = createContext(null);
export const useTutor = () => useContext(TutorContext);
