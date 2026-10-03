// Mock mode: realistic fixture outputs so the whole site runs without an API key.
import type { CityChoice } from "../shared/api";
import type { Dataset, DatasetCompany } from "../shared/dataset";
import type { Claim, Lang, MapDraft, Verdict } from "../shared/schemas";
import { SAMPLE_CV_EN, SAMPLE_POSTING_EN } from "../shared/samples";
import { detectLang } from "../shared/text";
import type { ClaimRef } from "../shared/verify";
import { TAILOR_VERDICT_OVERRIDES } from "./mock-tailor";

export { factSheet, tailorDraft } from "./mock-tailor";

export const SAMPLE_CV_TEXT = SAMPLE_CV_EN;
export const SAMPLE_POSTING_TEXT = SAMPLE_POSTING_EN;

export function verdicts(claims: ClaimRef[]): Verdict[] {
  const lang: Lang = detectLang(claims.map((c) => c.claim.text).join(" "));
  return claims.map((c) => {
    const o = TAILOR_VERDICT_OVERRIDES[c.path]?.[lang];
    if (o) return { id: c.path, verdict: o.verdict, problem: o.problem, fixedText: o.fixedText };
    return { id: c.path, verdict: "supported", problem: null, fixedText: null };
  });
}

// ---------------- job map ----------------

const T = (en: string, ar: string, factIds: string[]) => ({ en: { text: en, factIds }, ar: { text: ar, factIds } });

const TITLES = [
  ["Junior Data Analyst", "محلل بيانات مبتدئ", T("Power BI dashboard, SQL and pandas projects match this title directly.", "مشروع لوحة Power BI ومشاريع SQL وpandas تطابق هذا المسمى مباشرة.", ["F9", "F11", "F13"])],
  ["Business Intelligence Analyst", "محلل ذكاء أعمال", T("The graduation project is a Power BI dashboard on SQL Server.", "مشروع التخرج لوحة Power BI على SQL Server.", ["F9", "F10"])],
  ["Reporting Analyst", "محلل تقارير", T("Automated a weekly Excel report with Python during the internship.", "أتمتة تقرير Excel أسبوعي ببايثون خلال التدريب.", ["F6"])],
  ["Data Analyst - Graduate Program", "محلل بيانات - برنامج خريجين", T("Information Systems graduate (2026) with a GPA of 4.21 / 5.", "خريجة نظم معلومات (2026) بمعدل 4.21 من 5.", ["F18", "F2"])],
  ["IT Support Specialist", "أخصائي دعم فني", T("Resolved around 120 helpdesk tickets and set up 35 laptops as an intern.", "حل نحو 120 تذكرة دعم وتجهيز 35 حاسباً خلال التدريب.", ["F4", "F5"])],
  ["Service Desk Analyst", "محلل مكتب خدمة", T("Helpdesk tickets, Jira and Active Directory (basic).", "تذاكر الدعم وJira وActive Directory (أساسي).", ["F4", "F14"])],
  ["Junior Business Analyst", "محلل أعمال مبتدئ", T("Presented findings from the retail data-cleaning project.", "عرض نتائج مشروع تنظيف بيانات التجزئة.", ["F12"])],
  ["SQL Developer (Junior)", "مطور SQL مبتدئ", T("SQL Server in the graduation project and weekly SQL teaching sessions.", "SQL Server في مشروع التخرج وجلسات تدريب أسبوعية على SQL.", ["F9", "F8"])],
] as const;

const FIT_BY_KIND = {
  data: T(
    "Your Power BI dashboard on SQL Server and the 50,000-row pandas project are the evidence their data teams look for.",
    "لوحة Power BI على SQL Server ومشروع pandas على 50,000 صف هما الدليل الذي تبحث عنه فرق البيانات لديهم.",
    ["F9", "F10", "F12"],
  ),
  it: T(
    "Your internship covered helpdesk tickets, laptop setup and Active Directory basics, which is the entry work in their IT teams.",
    "تدريبك شمل تذاكر الدعم وتجهيز الحواسيب وأساسيات Active Directory، وهي مدخل العمل في فرق تقنية المعلومات لديهم.",
    ["F4", "F5", "F14"],
  ),
  software: T(
    "Python scripting that automated a weekly report shows you can build small tools, a good start for their graduate tech roles.",
    "سكربت بايثون الذي أتمت تقريراً أسبوعياً يُظهر قدرتك على بناء أدوات صغيرة، وهي بداية جيدة لوظائف الخريجين التقنية لديهم.",
    ["F6", "F13"],
  ),
  general: T(
    "An Information Systems degree with a 4.21 / 5 GPA fits their graduate intake.",
    "بكالوريوس نظم معلومات بمعدل 4.21 من 5 يناسب دفعات الخريجين لديهم.",
    ["F1", "F2"],
  ),
};

function kindOf(c: DatasetCompany): keyof typeof FIT_BY_KIND {
  const f = c.fields.join(" ");
  if (/data|analytics|ai/i.test(f)) return "data";
  if (/it-|support|enterprise|network/i.test(f)) return "it";
  if (/soft/i.test(f)) return "software";
  return "general";
}

const FIX_SPECS: Array<{ re: RegExp; title: [string, string]; detail: ReturnType<typeof T> }> = [
  {
    re: /strong|first|order/i,
    title: ["Put the dashboard project first", "قدّمي مشروع اللوحة أولاً"],
    detail: T(
      "For data roles, the Clinic Appointments Dashboard is your strongest evidence; place it above the IT internship.",
      "في وظائف البيانات، لوحة مواعيد العيادات أقوى دليل لديك؛ ضعيها فوق تدريب الدعم الفني.",
      ["F9", "F3"],
    ),
  },
  {
    re: /number|metric|quant|result/i,
    title: ["Add a result to each project", "أضيفي نتيجة لكل مشروع"],
    detail: T(
      "Your internship bullets already have numbers (120 tickets, 35 laptops). The dashboard project needs one too: [[confirm: a decision it supported or time it saved]].",
      "نقاط التدريب فيها أرقام (120 تذكرة، 35 حاسباً). مشروع اللوحة يحتاج رقماً أيضاً: [[تأكد: قرار دعمته أو وقت وفّرته]].",
      ["F4", "F5", "F10"],
    ),
  },
  {
    re: /relocat|city|location/i,
    title: ["Write Riyadh / Jeddah, ready to relocate", "اكتبي: الرياض / جدة، مستعدة للانتقال"],
    detail: T(
      "Your CV lists Jeddah only. If you would move, say so next to your contact details: [[confirm: ready to relocate to Riyadh?]].",
      "سيرتك تذكر جدة فقط. إن كنتِ مستعدة للانتقال فاذكري ذلك بجانب بيانات التواصل: [[تأكد: مستعدة للانتقال إلى الرياض؟]].",
      [],
    ),
  },
  {
    re: /headline|title|keyword/i,
    title: ["Use a target title as your headline", "اجعلي عنوان السيرة مسمى الوظيفة المستهدفة"],
    detail: T(
      "Replace 'Information Systems graduate (2026)' with a headline such as 'Junior Data Analyst | SQL, Power BI, Python'.",
      "استبدلي «خريجة نظم معلومات (2026)» بعنوان مثل «محللة بيانات مبتدئة | SQL وPower BI وبايثون».",
      ["F18", "F13"],
    ),
  },
  {
    re: /cert|off-track/i,
    title: ["Keep the certificate, and keep it on-track", "أبقي الشهادة المرتبطة بالمسار"],
    detail: T(
      "The Google Data Analytics certificate supports data roles; list it right under education.",
      "شهادة Google Data Analytics تدعم وظائف البيانات؛ ضعيها مباشرة تحت التعليم.",
      ["F15"],
    ),
  },
  {
    re: /linkedin|message|outreach|network/i,
    title: ["Send 10 direct LinkedIn messages a week", "أرسلي 10 رسائل مباشرة أسبوعياً على لينكدإن"],
    detail: T(
      "Don't wait for postings: message data team leads at your first-priority companies with a link to the dashboard project.",
      "لا تنتظري الإعلانات: راسلي قادة فرق البيانات في شركاتك ذات الأولوية مع رابط مشروع اللوحة.",
      ["F9"],
    ),
  },
];

export function mapDraft(lang: Lang, ds: Dataset, city: CityChoice): MapDraft {
  const wanted = ds.fields.map((f) => f.id).filter((id) => /soft|data|ai|it-|tech|digital|support|enterprise/i.test(id));
  const pref = city === "both" ? null : city;
  const ranked = ds.companies
    .map((c) => ({ c, score: (c.fields.some((f) => wanted.includes(f)) ? 2 : 0) + (pref && c.cities.includes(pref) ? 1 : 0) + (!pref && (c.cities.includes("riyadh") || c.cities.includes("jeddah")) ? 1 : 0) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const pick = (xs: { id: string; fields: string[] }[], n: number) =>
    xs.filter((x) => x.fields.includes("all") || x.fields.some((f) => wanted.includes(f))).slice(0, n).map((x) => x.id);

  const claim = (t: { en: Claim; ar: Claim }): Claim => structuredClone(t[lang]);

  return {
    outputLanguage: lang,
    profile: {
      summary: [
        claim(T("Information Systems graduate (2026) from King Abdulaziz University with a 4.21 / 5 GPA.", "خريجة نظم معلومات (2026) من جامعة الملك عبدالعزيز بمعدل 4.21 من 5.", ["F1", "F2", "F18"])),
        claim(T("Hands-on data work: a Power BI dashboard on SQL Server and a pandas data-cleaning project.", "خبرة عملية في البيانات: لوحة Power BI على SQL Server ومشروع تنظيف بيانات بـ pandas.", ["F9", "F11"])),
        claim(
          T(
            "IT support internship at Red Sea Logistics Co. (Jun 2025 - Aug 2025): helpdesk tickets, laptop setup and a Python reporting script.",
            "تدريب دعم فني في شركة البحر الأحمر للخدمات اللوجستية (يونيو 2025 - أغسطس 2025): تذاكر دعم وتجهيز حواسيب وسكربت بايثون للتقارير.",
            ["F3", "F4", "F5", "F6"],
          ),
        ),
      ],
      fields: wanted.length ? [wanted[0]] : [ds.fields[0]?.id ?? "general"],
      level: lang === "ar" ? "حديثة تخرج" : "Fresh graduate",
    },
    keyAlert: claim(
      T(
        "Your CV says Jeddah only, while many data roles are in Riyadh. State whether you would relocate: [[confirm: ready to relocate to Riyadh?]]",
        "سيرتك تذكر جدة فقط، بينما كثير من وظائف البيانات في الرياض. وضّحي استعدادك للانتقال: [[تأكد: مستعدة للانتقال إلى الرياض؟]]",
        [],
      ),
    ),
    titles: TITLES.map(([en, ar, why]) => ({ title: en, gloss: lang === "ar" ? ar : en, why: claim(why) })),
    companies: ranked.map((x, i) => ({
      companyId: x.c.id,
      priority: i < 4 ? "first" : i < 9 ? "second" : "backup",
      fit: claim(FIT_BY_KIND[kindOf(x.c)]),
    })),
    programIds: pick(ds.programs, 4),
    salaryRowIds: ds.salaryTable.filter((r) => wanted.includes(r.field) || r.field === "general").slice(0, 6).map((r) => r.id),
    platformIds: pick(ds.platforms, 6),
    cvFixes: FIX_SPECS.map((f) => ({
      title: lang === "ar" ? f.title[1] : f.title[0],
      detail: claim(f.detail),
      patternId: ds.cvPatterns.find((p) => f.re.test(p.id))?.id ?? null,
    })),
    needsInput: [],
  };
}
