import { useCallback, useId, useMemo, useState } from "react";
import type { StepId, TailorResponse } from "../../shared/api";
import { LIMITS } from "../../shared/api";
import { SAMPLE_CV_AR, SAMPLE_CV_EN, SAMPLE_POSTING_AR, SAMPLE_POSTING_EN } from "../../shared/samples";
import { useTitle } from "../components/helpers";
import { TailorResult } from "../components/TailorResult";
import { CvInput, ErrorPanel, ProgressPanel, RunPanel, StepCard, TextField, ToolHeader, useQuota } from "../components/tool";
import { Callout, Segmented } from "../components/ui";
import { useI18n } from "../i18n";
import { runTailor } from "../lib/api";
import { useConfig } from "../lib/config";
import { clientId } from "../lib/storage";
import { useRun } from "../lib/useRun";

export default function Tailor() {
  const { t, lang } = useI18n();
  useTitle(t.tool.tailorTitle);
  const cfg = useConfig();
  const { quota, refresh } = useQuota();
  const [cv, setCv] = useState("");
  const [posting, setPosting] = useState("");
  const [outLang, setOutLang] = useState<"auto" | "ar" | "en">("auto");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [tried, setTried] = useState(false);
  const pid = useId();

  const runner = useCallback(
    (onProgress: (s: StepId, st: "start" | "done") => void, signal: AbortSignal) =>
      runTailor({ cvText: cv, postingText: posting, outputLang: outLang, turnstileToken: token ?? "", clientId: clientId() }, onProgress, signal).finally(() => {
        setResetKey((k) => k + 1); // Turnstile tokens are single-use
        void refresh();
      }),
    [cv, posting, outLang, token, refresh],
  );
  const { phase, start, reset } = useRun<TailorResponse>(runner);

  const needsHuman = !!cfg?.turnstileSiteKey;
  const problems = useMemo(() => {
    const p: string[] = [];
    if (cv.trim().length < LIMITS.cvMinChars) p.push(t.tool.needCv(LIMITS.cvMinChars));
    if (posting.trim().length < LIMITS.postingMinChars) p.push(t.tool.needPosting(LIMITS.postingMinChars));
    if (cv.length > LIMITS.cvMaxChars || posting.length > LIMITS.postingMaxChars) p.push(t.errors.too_large);
    if (!consent) p.push(t.tool.needConsent);
    if (needsHuman && !token) p.push(t.tool.needHuman);
    return p;
  }, [cv, posting, consent, token, needsHuman, t]);

  const onRun = () => {
    setTried(true);
    if (problems.length === 0) void start();
  };

  if (phase.kind === "done") {
    return (
      <div className="container-page py-10 sm:py-14">
        <TailorResult data={phase.data} onStartOver={() => reset()} />
      </div>
    );
  }

  return (
    <div className="container-page py-10 sm:py-14">
      {phase.kind === "running" ? (
        <ProgressPanel steps={phase.steps} tool="tailor" />
      ) : phase.kind === "error" ? (
        <ErrorPanel error={phase.error} onRetry={() => reset()} onEdit={() => reset()} />
      ) : (
        <div className="space-y-8">
          <ToolHeader eyebrow={t.tool.tailorEyebrow} title={t.tool.tailorTitle} lead={t.tool.tailorLead} />
          {cfg?.mock && <Callout tone="warn">{t.result.mockBanner}</Callout>}
          <div className="grid gap-6 lg:grid-cols-2">
            <StepCard n={1} title={t.tool.stepCv}>
              <p className="mb-4 text-sm text-muted">{t.tool.cvHelp}</p>
              <CvInput value={cv} onChange={setCv} sample={lang === "ar" ? SAMPLE_CV_AR : SAMPLE_CV_EN} error={tried && cv.trim().length < LIMITS.cvMinChars ? t.tool.needCv(LIMITS.cvMinChars) : null} />
            </StepCard>
            <StepCard n={2} title={t.tool.stepPosting}>
              <div className="space-y-5">
                <TextField
                  id={`${pid}-posting`}
                  label={t.tool.postingLabel}
                  help={t.tool.postingHelp}
                  value={posting}
                  onChange={setPosting}
                  placeholder={t.tool.postingPlaceholder}
                  max={LIMITS.postingMaxChars}
                  rows={12}
                  error={tried && posting.trim().length < LIMITS.postingMinChars ? t.tool.needPosting(LIMITS.postingMinChars) : null}
                />
                <button type="button" className="text-sm font-medium text-primary-text hover:underline underline-offset-4" onClick={() => setPosting(lang === "ar" ? SAMPLE_POSTING_AR : SAMPLE_POSTING_EN)}>
                  {t.tool.sample}
                </button>
                <Segmented
                  name={`${pid}-lang`}
                  label={t.tool.outLang}
                  value={outLang}
                  onChange={setOutLang}
                  options={[
                    { value: "auto", label: t.tool.outAuto },
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
              label={t.tool.runTailor}
              onRun={onRun}
              problems={tried ? problems : []}
            />
          </StepCard>
        </div>
      )}
    </div>
  );
}
