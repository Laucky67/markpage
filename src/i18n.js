import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zhUI from "./locales/zh/ui.json";
import enUI from "./locales/en/ui.json";
import zhTasks from "./locales/zh/tasks.json";
import enTasks from "./locales/en/tasks.json";
import zhGeoNames from "./locales/zh/geoNames.json";
import enGeoNames from "./locales/en/geoNames.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { ui: zhUI, tasks: zhTasks, geoNames: zhGeoNames },
      en: { ui: enUI, tasks: enTasks, geoNames: enGeoNames },
    },
    fallbackLng: "zh",
    defaultNS: "ui",
    ns: ["ui", "tasks", "geoNames"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage"],
      lookupLocalStorage: "geolocus-lang",
      caches: ["localStorage"],
    },
  });

export default i18n;
