
declare namespace google {
  namespace translate {
    class TranslateElement {
      constructor(options: {
        pageLanguage: string;
        includedLanguages?: string;
        layout?: any;
        autoDisplay?: boolean;
      }, elementId: string);

      static InlineLayout: {
        HORIZONTAL: any;
        SIMPLE: any;
        VERTICAL: any;
      };
    }
  }
}

declare global {
  interface Window {
    googleTranslateElementInit: () => void;
    google: typeof google;
  }
}

export {};
