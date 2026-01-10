import React, { useMemo, useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Mock server hook - replace with real server action call
function useCapabilities(callId: string) {
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/call-capabilities?callId=${encodeURIComponent(callId)}`, { method: 'GET' })
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        setCapabilities(json?.allowed ?? {});
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setCapabilities({});
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [callId]);

  return { loading, capabilities } as { loading: boolean; capabilities: Record<string, boolean> };
}

type ModulationKey = "record" | "transcribe" | "translate" | "survey" | "synthetic_caller";
export type CallModulations = Record<ModulationKey, boolean>;

export interface CallModulationsProps {
  callId: string;
  initialModulations: Partial<CallModulations>;
  onChange: (modulations: CallModulations) => Promise<void>;
}

export default function CallModulations({ callId, initialModulations, onChange }: CallModulationsProps) {
  const defaults: CallModulations = useMemo(
    () => ({
      record: false,
      transcribe: false,
      translate: false,
      survey: false,
      synthetic_caller: false,
    }),
    []
  );

  const [mods, setMods] = useState<CallModulations>({ ...defaults, ...initialModulations });
  const { loading: capsLoading, capabilities } = useCapabilities(callId);

  const handleToggle = async (key: ModulationKey) => {
    const loading = capsLoading;
    const allowed = Boolean(capabilities[key]);
    if (loading || !allowed) return;

    const prev = mods;
    const next = { ...mods, [key]: !mods[key] };
    setMods(next); // optimistic
    try {
      await onChange(next);
    } catch {
      setMods(prev); // rollback
      // ideally: toast error
    }
  };

  const items = [
    { key: "record" as ModulationKey, label: "Record", hint: "Start/stop recording for this call" },
    { key: "transcribe" as ModulationKey, label: "Transcribe", hint: "Enable transcription" },
    { key: "translate" as ModulationKey, label: "Translate", hint: "Enable live translation" },
    { key: "survey" as ModulationKey, label: "Survey", hint: "Post-call survey" },
    { key: "synthetic_caller" as ModulationKey, label: "Synthetic Caller", hint: "Inject synthetic caller" },
  ];

  return (
    <TooltipProvider>
      <div className="w-full bg-slate-900 text-slate-100 rounded-md p-4">
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => {
            const checked = !!mods[item.key];
            const disabled = capsLoading || !Boolean(capabilities[item.key]);
            const hintId = `${item.key}-hint`;

            return (
              <div key={item.key} className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-slate-800">
                <div className="flex items-center space-x-2">
                  <Switch
                    id={item.key}
                    checked={checked}
                    onCheckedChange={() => handleToggle(item.key)}
                    disabled={disabled}
                    className={`${checked ? "bg-indigo-500" : "bg-slate-700"} relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ring-offset-slate-900`}
                    role="switch"
                    aria-checked={checked}
                    aria-describedby={disabled ? hintId : undefined}
                  />

                  <Label htmlFor={item.key} className="text-sm font-medium">
                    {item.label}
                  </Label>
                </div>

                {item.hint && disabled ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-xs text-slate-400 cursor-help" aria-describedby={hintId}>
                          Why disabled?
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{item.hint} (Plan upgrade may be required)</TooltipContent>
                    </Tooltip>
                    <span id={hintId} className="sr-only">
                      {item.hint} (Plan upgrade may be required)
                    </span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
