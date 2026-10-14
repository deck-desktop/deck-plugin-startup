import StartupManager from "./StartupManager";

// What launches when you log in, on which days and within which time window.
export default function Tab() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div className="min-h-0 flex-1">
        <StartupManager />
      </div>
    </div>
  );
}
