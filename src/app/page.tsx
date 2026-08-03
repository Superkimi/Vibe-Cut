import { EditorShell } from "@/components/editor/EditorShell";
import { I18nProvider } from "@/i18n";
import { ThemeProvider } from "@/theme";

export default function Home() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <EditorShell />
      </I18nProvider>
    </ThemeProvider>
  );
}
