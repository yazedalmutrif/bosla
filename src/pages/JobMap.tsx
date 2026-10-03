import { useCallback, useId, useMemo, useState } from "react";
import type { CityChoice, MapResponse, StepId } from "../../shared/api";
import { LIMITS } from "../../shared/api";
import { SAMPLE_CV_AR, SAMPLE_CV_EN } from "../../shared/samples";
import { useTitle } from "../components/helpers";
import { MapResult } from "../components/MapResult";
import { CvInput, ErrorPanel, ProgressPanel, RunPanel, StepCard, ToolHeader, useQuota } from "../components/tool";
import { Callout, Segmented } from "../components/ui";
import { useI18n } from "../i18n";
import { runMap } from "../lib/api";
import { useConfig } from "../lib/config";
import { clientId } from "../lib/storage";
import { useRun } from "../lib/useRun";

export default function JobMap() {
  const { t, lang } = useI18n();
  useTitle(t.tool.mapTitle);
  const cfg = useConfig();
  const { quota, refresh } = useQuota();
  const [cv, setCv] = useState("");
  const [city, setCity] = useState<CityChoice>("both");
  const [outLang, setOutLang] = useState<"ar" | "en">(lang);
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [tried, setTried] = useState(false);
  const pid = useId();

  const runner = useCallback(
    (onProgress: (s: StepId, st: "start" | "done") => void, signal: AbortSignal) =>
      runMap({ cvText: cv, city, outputLang: outLang, turnstileToken: token ?? "", clientId: clientId() }, onProgress, signal).finally(() => {
        setResetKey((k) => k + 1);
        void refresh();
      }),
    [cv, city, outLang, token, refresh],
  );
  const { phase, start, reset } = useRun<MapResponse>(runner);

  const needsHuman = !!cfg?.turnstileSiteKey;
  const problems = useMemo(() => {
    const p: string[] = [];
    if (cv.trim().length < LIMITS.cvMinChars) p.push(t.tool.needCv(LIMITS.cvMinChars));
    if (cv.length > LIMITS.cvMaxChars) p.push(t.errors.too_large);
    if (!consent) p.push(t.tool.needConsent);
    if (needsHuman && !token) p.push(t.tool.needHuman);
    return p;
  }, [cv, consent, token, needsHuman, t]);

  if (phase.kind === "done") {
    return (
      <div className="container-page py-10 sm:py-14">
        <MapResult data={phase.data} onStartOver={() => reset()} />
      </div>
    );
  }

  return (
    <div className="container-page py-10 sm:py-14">
      {phase.kind === "running" ? (
        <ProgressPanel steps={phase.steps} tool="map" />
      ) : phase.kind === "error" ? (
        <ErrorPanel error={phase.error} onRetry={() => reset()} onEdit={() => reset()} />
      ) : (
        <div className="space-y-8">
          <ToolHeader eyebrow={t.tool.mapEyebrow} title={t.tool.mapTitle} lead={t.tool.mapLead} />
          {cfg?.mock && <Callout tone="warn">{t.result.mockBanner}</Callout>}
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <StepCard n={1} title={t.tool.stepCv}>
              <p className="mb-4 text-sm text-muted">{t.tool.cvHelp}</p>
              <CvInput value={cv} onChange={setCv} sample={lang === "ar" ? SAMPLE_CV_AR : SAMPLE_CV_EN} error={tried && cv.trim().length < LIMITS.cvMinChars ? t.tool.needCv(LIMITS.cvMinChars) : null} />
            </StepCard>
            <StepCard n={2} title={t.tool.stepPrefs}>
              <div className="space-y-6">
                <Segmented
                  name={`${pid}-city`}
                  label={t.tool.cityLabel}
                  value={city}
                  onChange={setCity}
                  options={[
                    { value: "both", label: t.tool.cityBoth },
                    { value: "riyadh", label: t.tool.cityRiyadh },
                    { value: "jeddah", label: t.tool.cityJeddah },
                  ]}
                />
                <Segmented
                  name={`${pid}-lang`}
                  label={t.tool.outLang}
                  value={outLang}
                  onChange={setOutLang}
                  options={[
                    { value: "ar", label: t.tool.outAr },
                    { value: "en", label: t.tool.outEn },
                  ]}
                />
              </div>
            </StepCard>
          </div>
          <StepCard n={3} title={t.tool.stepRun}>
            <RunPanel
              siteKey={cfg?.turnstileSiteKey || null}
              mock={!!cfg?.mock}
              consent={consent}
              setConsent={setConsent}
              onToken={setToken}
              resetKey={resetKey}
              quota={quota}
              running={false}
              label={t.tool.runMap}
              onRun={() => {
                setTried(true);
                if (problems.length === 0) void start();
              }}
              problems={tried ? problems : []}
            />
          </StepCard>
        </div>
      )}
    </div>
  );
}
