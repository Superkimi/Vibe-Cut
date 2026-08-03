import { EditorShell } from "@/components/editor/EditorShell";
import { I18nProvider } from "@/i18n";

export default function Home() {
  return (
    <I18nProvider>
      <EditorShell />
    </I18nProvider>
  );
}
