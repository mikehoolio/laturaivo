import { getPlatformCapabilities } from "./platform";

export const shouldUseKeyboardControlCopy = (): boolean => {
  const platform = getPlatformCapabilities();
  return (platform.isWeb || platform.isSteam) && !platform.isCapacitorIOS;
};

export const getContinuePromptText = (): string => {
  return shouldUseKeyboardControlCopy()
    ? "ENTER / SPACE / NAPAUTA JATKAAKSESI"
    : "NAPAUTA JATKAAKSESI";
};

export const getSkipPromptText = (): string => {
  return shouldUseKeyboardControlCopy()
    ? "ENTER / SPACE / NAPAUTA = OHITA"
    : "NAPAUTA = OHITA";
};

export const getSkipScreenPromptText = (): string => {
  return shouldUseKeyboardControlCopy()
    ? "ENTER / SPACE / NAPAUTA OHITTAAKSESI"
    : "Napauta ruutua ohittaaksesi";
};

export const getPausePromptText = (): string => {
  return shouldUseKeyboardControlCopy()
    ? "Jatka: Esc / P / klikkaa taustaa"
    : "Napauta jatkaaksesi";
};

export const getConfirmAgainText = (): string => {
  return shouldUseKeyboardControlCopy()
    ? "🏠 VAHVISTA UUDESTAAN"
    : "🏠 NAPAUTA UUDESTA (VARMISTA)";
};

export const getStartPromptText = (): string => {
  return shouldUseKeyboardControlCopy()
    ? "ENTER / SPACE / NAPAUTA ALOITA"
    : "▶ ALOITA PELI ◀";
};

export const getNameInputHintText = (): string => {
  return shouldUseKeyboardControlCopy()
    ? "Klikkaa kenttää kirjoittaaksesi • Enter aloittaa"
    : "Napauta kenttää kirjoittaaksesi • enintään 12 merkkiä";
};

export const getStartButtonHintText = (): string => {
  return shouldUseKeyboardControlCopy()
    ? "Enter tai klikkaus aloittaa"
    : "Napauta aloittaaksesi";
};

export const formatSkipHintLine = (text: string): string => {
  if (!shouldUseKeyboardControlCopy()) return text;
  if (/ENTER\s*\/\s*SPACE/i.test(text)) return text;
  return text.replace(/NAPAUTA OHITTAKSESI/gi, "ENTER / SPACE / NAPAUTA OHITTAKSESI");
};
