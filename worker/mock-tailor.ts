// Fixture outputs for mock mode (no API key). They describe the fictional sample CV in shared/samples.ts.
// Two claims are wrong on purpose so the verifier's removal and rewrite paths are visible in mock mode.
import type { FactSheet, Lang, TailorDraft } from "../shared/schemas";

export function factSheet(): FactSheet {
  return {
    isCv: true,
    cvLanguage: "en",
    person: {
      name: "Lama Abdullah",
      email: "lama.sample@example.com",
      phone: "+966 50 000 0000",
      location: "Jeddah, Saudi Arabia",
      links: ["linkedin.com/in/lama-sample"],
    },
    headline: "Information Systems graduate (2026)",
    facts: [
      { id: "F1", category: "education", text: "B.Sc. Information Systems, King Abdulaziz University, Jeddah (2022 - 2026)", org: "King Abdulaziz University", role: "B.Sc. Information Systems", start: "2022", end: "2026", alt: "بكالوريوس نظم المعلومات، جامعة الملك عبدالعزيز، جدة (2022 - 2026)" },
      { id: "F2", category: "education", text: "GPA 4.21 / 5", org: "King Abdulaziz University", role: null, start: null, end: null, alt: "المعدل 4.21 من 5" },
      { id: "F3", category: "experience", text: "IT Support Intern, Red Sea Logistics Co., Jeddah (Jun 2025 - Aug 2025)", org: "Red Sea Logistics Co.", role: "IT Support Intern", start: "Jun 2025", end: "Aug 2025", alt: "متدربة دعم فني، شركة البحر الأحمر للخدمات اللوجستية، جدة (يونيو 2025 - أغسطس 2025)" },
      { id: "F4", category: "experience", text: "Resolved around 120 helpdesk tickets for hardware, email and printer issues.", org: "Red Sea Logistics Co.", role: "IT Support Intern", start: null, end: null, alt: "حل نحو 120 تذكرة دعم فني لمشكلات الأجهزة والبريد والطابعات." },
      { id: "F5", category: "experience", text: "Imaged and set up 35 laptops for new employees using a standard checklist.", org: "Red Sea Logistics Co.", role: "IT Support Intern", start: null, end: null, alt: "تجهيز 35 حاسباً محمولاً للموظفين الجدد وفق قائمة تحقق موحدة." },
      { id: "F6", category: "experience", text: "Wrote a Python script that merged weekly ticket exports into one Excel report.", org: "Red Sea Logistics Co.", role: "IT Support Intern", start: null, end: null, alt: "كتابة سكربت بايثون يدمج تقارير التذاكر الأسبوعية في تقرير Excel واحد." },
      { id: "F7", category: "volunteer", text: "Teaching Assistant (volunteer), Coding Club, King Abdulaziz University (Sep 2024 - May 2025)", org: "Coding Club, King Abdulaziz University", role: "Teaching Assistant (volunteer)", start: "Sep 2024", end: "May 2025", alt: "مساعدة تدريس (تطوعاً)، نادي البرمجة، جامعة الملك عبدالعزيز (سبتمبر 2024 - مايو 2025)" },
      { id: "F8", category: "volunteer", text: "Ran weekly SQL and Python practice sessions for first-year students.", org: "Coding Club, King Abdulaziz University", role: null, start: null, end: null, alt: "تقديم جلسات تدريب أسبوعية على SQL وبايثون لطلاب السنة الأولى." },
      { id: "F9", category: "project", text: "Clinic Appointments Dashboard (graduation project, team of 4) - Power BI, SQL Server", org: null, role: null, start: null, end: null, alt: "لوحة مواعيد العيادات (مشروع التخرج، فريق من 4) - Power BI وSQL Server" },
      { id: "F10", category: "project", text: "Built a dashboard showing no-show rates by clinic and weekday for a university clinic dataset.", org: null, role: null, start: null, end: null, alt: "بناء لوحة تعرض نسب عدم الحضور حسب العيادة ويوم الأسبوع لبيانات عيادة جامعية." },
      { id: "F11", category: "project", text: "Sales Data Cleaning - Python (pandas)", org: null, role: null, start: null, end: null, alt: "تنظيف بيانات المبيعات - بايثون (pandas)" },
      { id: "F12", category: "project", text: "Cleaned and analysed a 50,000-row public retail dataset and presented the findings.", org: null, role: null, start: null, end: null, alt: "تنظيف وتحليل بيانات تجزئة عامة من 50,000 صف وعرض النتائج." },
      { id: "F13", category: "skill", text: "SQL, Python (pandas), Power BI, Excel (pivot tables, XLOOKUP)", org: null, role: null, start: null, end: null, alt: "SQL، بايثون (pandas)، Power BI، Excel (الجداول المحورية، XLOOKUP)" },
      { id: "F14", category: "skill", text: "Windows 10/11 support, Active Directory (basic), Jira", org: null, role: null, start: null, end: null, alt: "دعم Windows 10/11، Active Directory (أساسي)، Jira" },
      { id: "F15", category: "certification", text: "Google Data Analytics Professional Certificate (Coursera), 2025", org: "Coursera", role: "Google Data Analytics Professional Certificate", start: "2025", end: null, alt: "شهادة Google Data Analytics Professional Certificate من Coursera، 2025" },
      { id: "F16", category: "language", text: "Arabic (native)", org: null, role: null, start: null, end: null, alt: "العربية (اللغة الأم)" },
      { id: "F17", category: "language", text: "English (fluent)", org: null, role: null, start: null, end: null, alt: "الإنجليزية (بطلاقة)" },
      { id: "F18", category: "summary", text: "Information Systems graduate (2026)", org: null, role: null, start: null, end: "2026", alt: "خريجة نظم معلومات (2026)" },
    ],
    gaps: [
      { item: "Current city or willingness to relocate to Riyadh", why: "Many data roles are in Riyadh and screening filters use the candidate's city." },
      { item: "A measurable result for the dashboard project", why: "A result (a decision it supported, time saved) makes the project read as real work." },
      { item: "Graduation month", why: "Graduate programmes check the exact graduation date." },
    ],
  };
}

const EN: TailorDraft = {
  outputLanguage: "en",
  posting: {
    title: "Junior Data Analyst",
    company: "Example Retail Co.",
    location: "Riyadh",
    mustHaves: [
      "Bachelor's in Information Systems, Computer Science, Statistics or related",
      "Strong SQL and Excel",
      "Power BI or Tableau",
      "Communication in Arabic and English",
      "0-2 years of experience (fresh graduates welcome)",
    ],
    niceToHaves: ["Python (pandas) for data cleaning", "Retail or e-commerce data", "Google Data Analytics or PL-300 certificate"],
    keywords: ["SQL", "Power BI", "Excel", "dashboards", "data cleaning", "stakeholders", "Python", "pandas", "retail", "reporting automation"],
  },
  leadWith: { text: "Leading with the Clinic Appointments Dashboard (Power BI, SQL Server) because the posting asks for Power BI dashboards and SQL.", factIds: ["F9", "F10"] },
  fit: [
    { requirement: "Bachelor's in Information Systems or related", level: "strong", evidence: { text: "B.Sc. Information Systems, King Abdulaziz University (2022 - 2026).", factIds: ["F1"] }, howToAddress: "Keep education near the top: it matches the first requirement exactly." },
    { requirement: "Strong SQL and Excel", level: "strong", evidence: { text: "SQL Server in the graduation dashboard; weekly SQL practice sessions; Excel pivot tables and XLOOKUP.", factIds: ["F9", "F8", "F13"] }, howToAddress: "Name SQL and Excel in the headline and the first project bullet." },
    { requirement: "Power BI or Tableau", level: "strong", evidence: { text: "Built a Power BI dashboard of no-show rates by clinic and weekday.", factIds: ["F9", "F10"] }, howToAddress: "Lead with this project." },
    { requirement: "Communication in Arabic and English", level: "strong", evidence: { text: "Arabic (native), English (fluent); ran weekly practice sessions for first-year students.", factIds: ["F16", "F17", "F8"] }, howToAddress: "Mention the teaching sessions as evidence of explaining data to non-experts." },
    { requirement: "0-2 years of experience", level: "partial", evidence: { text: "IT support internship, Jun 2025 - Aug 2025.", factIds: ["F3"] }, howToAddress: "Fresh graduates are welcome; let the projects carry the data experience." },
    { requirement: "Python (pandas)", level: "strong", evidence: { text: "Cleaned and analysed a 50,000-row public retail dataset with pandas.", factIds: ["F11", "F12"] }, howToAddress: "Keep this project on the CV." },
    { requirement: "Retail or e-commerce data", level: "partial", evidence: { text: "The data-cleaning project used a public retail dataset.", factIds: ["F12"] }, howToAddress: "Say it was a public dataset; don't present it as work for a retailer." },
    { requirement: "Google Data Analytics or PL-300", level: "strong", evidence: { text: "Google Data Analytics Professional Certificate (Coursera), 2025.", factIds: ["F15"] }, howToAddress: "List it under certifications." },
  ],
  cv: {
    name: "Lama Abdullah",
    headline: "Junior Data Analyst | SQL, Power BI, Python",
    contact: ["lama.sample@example.com", "+966 50 000 0000", "linkedin.com/in/lama-sample"],
    location: "Jeddah [[confirm: ready to relocate to Riyadh?]]",
    summary: [
      { text: "Information Systems graduate (2026) with hands-on SQL, Power BI and Python (pandas) from a graduation dashboard project and a retail data-cleaning project.", factIds: ["F18", "F9", "F11", "F12", "F13"] },
      { text: "IT support internship experience: resolved around 120 helpdesk tickets and automated a weekly Excel report with Python.", factIds: ["F3", "F4", "F6"] },
      { text: "Experienced with Tableau and advanced statistical modelling.", factIds: ["F13"] },
    ],
    skills: [
      { group: "Data", items: ["SQL", "Python (pandas)", "Power BI", "Excel (pivot tables, XLOOKUP)"], factIds: ["F13"] },
      { group: "IT tools", items: ["Jira", "Active Directory (basic)", "Windows 10/11 support"], factIds: ["F14"] },
    ],
    experience: [
      {
        role: "IT Support Intern",
        org: "Red Sea Logistics Co.",
        location: "Jeddah",
        dates: "Jun 2025 - Aug 2025",
        factIds: ["F3"],
        bullets: [
          { text: "Automated the weekly helpdesk report: wrote a Python script that merges ticket exports into one Excel file, saving about 3 hours a week.", factIds: ["F6"] },
          { text: "Resolved around 120 helpdesk tickets covering hardware, email and printer issues.", factIds: ["F4"] },
          { text: "Imaged and set up 35 laptops for new employees using a standard checklist.", factIds: ["F5"] },
        ],
      },
      {
        role: "Teaching Assistant (volunteer)",
        org: "Coding Club, King Abdulaziz University",
        location: "Jeddah",
        dates: "Sep 2024 - May 2025",
        factIds: ["F7"],
        bullets: [{ text: "Ran weekly SQL and Python practice sessions for first-year students.", factIds: ["F8"] }],
      },
    ],
    projects: [
      {
        name: "Clinic Appointments Dashboard",
        context: "Graduation project, team of 4",
        dates: null,
        factIds: ["F9"],
        bullets: [
          { text: "Built a Power BI dashboard on SQL Server showing no-show rates by clinic and weekday for a university clinic dataset.", factIds: ["F9", "F10"] },
          { text: "Result: [[confirm: a decision or saving the dashboard supported]].", factIds: ["F10"] },
        ],
      },
      {
        name: "Sales Data Cleaning",
        context: "Personal project, Python (pandas)",
        dates: null,
        factIds: ["F11"],
        bullets: [{ text: "Cleaned and analysed a 50,000-row public retail dataset in Python (pandas) and presented the findings.", factIds: ["F11", "F12"] }],
      },
    ],
    education: [
      { degree: "B.Sc. Information Systems", institution: "King Abdulaziz University, Jeddah", dates: "2022 - 2026", factIds: ["F1"], details: [{ text: "GPA 4.21 / 5", factIds: ["F2"] }] },
    ],
    certifications: [{ name: "Google Data Analytics Professional Certificate", issuer: "Coursera", date: "2025", factIds: ["F15"] }],
    languages: [
      { text: "Arabic (native)", factIds: ["F16"] },
      { text: "English (fluent)", factIds: ["F17"] },
    ],
  },
  coverLetter: {
    greeting: "Dear Hiring Team,",
    paragraphs: [
      { text: "I would like to apply for the Junior Data Analyst role in your Commercial Analytics team in Riyadh. I graduated in Information Systems from King Abdulaziz University in 2026, and the work you describe, turning sales and store data into weekly reports, is the work I have been practising.", factIds: ["F1", "F18"] },
      { text: "Power BI and SQL: for my graduation project, our team of 4 built a Power BI dashboard on SQL Server that shows clinic no-show rates by clinic and weekday.", factIds: ["F9", "F10"] },
      { text: "Automating recurring reports: during my IT support internship at Red Sea Logistics Co., I wrote a Python script that merged weekly ticket exports into one Excel report, alongside resolving around 120 helpdesk tickets.", factIds: ["F3", "F4", "F6"] },
      { text: "Clean data: I cleaned and analysed a 50,000-row public retail dataset with Python (pandas), and I hold the Google Data Analytics Professional Certificate (2025).", factIds: ["F11", "F12", "F15"] },
      { text: "I work comfortably in Arabic and English, and I ran weekly SQL and Python practice sessions for first-year students. I am [[confirm: based in Riyadh or ready to relocate]] and would welcome the chance to discuss how I can help your category managers.", factIds: ["F16", "F17", "F8"] },
    ],
    closing: "Kind regards,",
    signature: "Lama Abdullah",
  },
  tweaks: [
    "For data roles, move the Clinic Appointments Dashboard above the internship.",
    "Add one measurable result to the dashboard project, such as a decision it supported.",
    "State your city or relocation plan next to your contact details.",
    "Put Power BI and SQL in your headline so keyword filters find them.",
  ],
  needsInput: [{ item: "Relocation to Riyadh", why: "The posting requires candidates based in or willing to relocate to Riyadh." }],
};

const AR: TailorDraft = {
  outputLanguage: "ar",
  posting: {
    title: "محلل بيانات مبتدئ",
    company: "شركة مثال للتجزئة",
    location: "الرياض",
    mustHaves: [
      "بكالوريوس نظم معلومات أو علوم حاسب أو إحصاء أو تخصص قريب",
      "مهارة قوية في SQL وExcel",
      "خبرة في Power BI أو Tableau",
      "تواصل جيد بالعربية والإنجليزية",
      "خبرة من 0 إلى 2 سنة (نرحب بحديثي التخرج)",
    ],
    niceToHaves: ["بايثون (pandas) لتنظيف البيانات", "بيانات التجزئة أو التجارة الإلكترونية", "شهادة Google Data Analytics أو PL-300"],
    keywords: ["SQL", "Power BI", "Excel", "لوحات بيانات", "تنظيف البيانات", "أصحاب المصلحة", "Python", "pandas", "التجزئة", "أتمتة التقارير"],
  },
  leadWith: { text: "نبدأ بمشروع لوحة مواعيد العيادات (Power BI وSQL Server) لأن الإعلان يطلب لوحات Power BI ومهارة SQL.", factIds: ["F9", "F10"] },
  fit: [
    { requirement: "بكالوريوس نظم معلومات أو تخصص قريب", level: "strong", evidence: { text: "بكالوريوس نظم المعلومات، جامعة الملك عبدالعزيز (2022 - 2026).", factIds: ["F1"] }, howToAddress: "أبقِ التعليم في أعلى السيرة؛ فهو يطابق أول متطلب." },
    { requirement: "مهارة قوية في SQL وExcel", level: "strong", evidence: { text: "SQL Server في لوحة مشروع التخرج، وجلسات تدريب أسبوعية على SQL، والجداول المحورية وXLOOKUP في Excel.", factIds: ["F9", "F8", "F13"] }, howToAddress: "اذكر SQL وExcel في العنوان وفي أول نقطة من المشروع." },
    { requirement: "Power BI أو Tableau", level: "strong", evidence: { text: "بناء لوحة Power BI لنسب عدم الحضور حسب العيادة ويوم الأسبوع.", factIds: ["F9", "F10"] }, howToAddress: "ابدأ السيرة بهذا المشروع." },
    { requirement: "التواصل بالعربية والإنجليزية", level: "strong", evidence: { text: "العربية لغة أم، والإنجليزية بطلاقة، مع تقديم جلسات تدريب أسبوعية لطلاب السنة الأولى.", factIds: ["F16", "F17", "F8"] }, howToAddress: "اذكري جلسات التدريب دليلاً على شرح البيانات لغير المتخصصين." },
    { requirement: "خبرة من 0 إلى 2 سنة", level: "partial", evidence: { text: "تدريب دعم فني، يونيو 2025 - أغسطس 2025.", factIds: ["F3"] }, howToAddress: "الإعلان يرحب بحديثي التخرج؛ دعي المشاريع تحمل خبرة البيانات." },
    { requirement: "بايثون (pandas)", level: "strong", evidence: { text: "تنظيف وتحليل بيانات تجزئة عامة من 50,000 صف باستخدام pandas.", factIds: ["F11", "F12"] }, howToAddress: "أبقي هذا المشروع في السيرة." },
    { requirement: "بيانات التجزئة", level: "partial", evidence: { text: "مشروع تنظيف البيانات استخدم بيانات تجزئة عامة.", factIds: ["F12"] }, howToAddress: "وضّحي أنها بيانات عامة، ولا تقدميها كعمل لدى شركة تجزئة." },
    { requirement: "شهادة Google Data Analytics أو PL-300", level: "strong", evidence: { text: "شهادة Google Data Analytics Professional Certificate من Coursera، 2025.", factIds: ["F15"] }, howToAddress: "اذكريها في قسم الشهادات." },
  ],
  cv: {
    name: "Lama Abdullah",
    headline: "محللة بيانات مبتدئة | SQL وPower BI وبايثون",
    contact: ["lama.sample@example.com", "+966 50 000 0000", "linkedin.com/in/lama-sample"],
    location: "جدة [[تأكد: مستعدة للانتقال إلى الرياض؟]]",
    summary: [
      { text: "خريجة نظم معلومات (2026) بخبرة عملية في SQL وPower BI وبايثون (pandas) من مشروع تخرج لبناء لوحة بيانات ومشروع لتنظيف بيانات تجزئة.", factIds: ["F18", "F9", "F11", "F12", "F13"] },
      { text: "خبرة تدريب في الدعم الفني: حل نحو 120 تذكرة دعم وأتمتة تقرير Excel أسبوعي باستخدام بايثون.", factIds: ["F3", "F4", "F6"] },
      { text: "خبرة واسعة في Tableau والنمذجة الإحصائية المتقدمة.", factIds: ["F13"] },
    ],
    skills: [
      { group: "البيانات", items: ["SQL", "بايثون (pandas)", "Power BI", "Excel (الجداول المحورية، XLOOKUP)"], factIds: ["F13"] },
      { group: "أدوات تقنية", items: ["Jira", "Active Directory (أساسي)", "دعم Windows 10/11"], factIds: ["F14"] },
    ],
    experience: [
      {
        role: "متدربة دعم فني",
        org: "شركة البحر الأحمر للخدمات اللوجستية",
        location: "جدة",
        dates: "يونيو 2025 - أغسطس 2025",
        factIds: ["F3"],
        bullets: [
          { text: "أتمتة تقرير الدعم الأسبوعي: كتابة سكربت بايثون يدمج تقارير التذاكر في ملف Excel واحد، وفّر نحو 3 ساعات أسبوعياً.", factIds: ["F6"] },
          { text: "حل نحو 120 تذكرة دعم فني لمشكلات الأجهزة والبريد والطابعات.", factIds: ["F4"] },
          { text: "تجهيز 35 حاسباً محمولاً للموظفين الجدد وفق قائمة تحقق موحدة.", factIds: ["F5"] },
        ],
      },
      {
        role: "مساعدة تدريس (تطوعاً)",
        org: "نادي البرمجة، جامعة الملك عبدالعزيز",
        location: "جدة",
        dates: "سبتمبر 2024 - مايو 2025",
        factIds: ["F7"],
        bullets: [{ text: "تقديم جلسات تدريب أسبوعية على SQL وبايثون لطلاب السنة الأولى.", factIds: ["F8"] }],
      },
    ],
    projects: [
      {
        name: "لوحة مواعيد العيادات",
        context: "مشروع التخرج، فريق من 4",
        dates: null,
        factIds: ["F9"],
        bullets: [
          { text: "بناء لوحة Power BI على SQL Server تعرض نسب عدم الحضور حسب العيادة ويوم الأسبوع لبيانات عيادة جامعية.", factIds: ["F9", "F10"] },
          { text: "النتيجة: [[تأكد: قرار أو توفير دعمته اللوحة]].", factIds: ["F10"] },
        ],
      },
      {
        name: "تنظيف بيانات المبيعات",
        context: "مشروع شخصي، بايثون (pandas)",
        dates: null,
        factIds: ["F11"],
        bullets: [{ text: "تنظيف وتحليل بيانات تجزئة عامة من 50,000 صف باستخدام بايثون (pandas) وعرض النتائج.", factIds: ["F11", "F12"] }],
      },
    ],
    education: [
      { degree: "بكالوريوس نظم المعلومات", institution: "جامعة الملك عبدالعزيز، جدة", dates: "2022 - 2026", factIds: ["F1"], details: [{ text: "المعدل 4.21 من 5", factIds: ["F2"] }] },
    ],
    certifications: [{ name: "Google Data Analytics Professional Certificate", issuer: "Coursera", date: "2025", factIds: ["F15"] }],
    languages: [
      { text: "العربية (اللغة الأم)", factIds: ["F16"] },
      { text: "الإنجليزية (بطلاقة)", factIds: ["F17"] },
    ],
  },
  coverLetter: {
    greeting: "فريق التوظيف المحترم،",
    paragraphs: [
      { text: "أتقدم لوظيفة محلل بيانات مبتدئ في فريق التحليلات التجارية لديكم في الرياض. تخرجت في نظم المعلومات من جامعة الملك عبدالعزيز عام 2026، والعمل الذي تصفونه، أي تحويل بيانات المبيعات والفروع إلى تقارير أسبوعية، هو ما تدربت عليه.", factIds: ["F1", "F18"] },
      { text: "في Power BI وSQL: بنينا في مشروع التخرج، ضمن فريق من 4، لوحة Power BI على SQL Server تعرض نسب عدم الحضور حسب العيادة ويوم الأسبوع.", factIds: ["F9", "F10"] },
      { text: "في أتمتة التقارير الدورية: كتبت خلال تدريبي في الدعم الفني لدى شركة البحر الأحمر للخدمات اللوجستية سكربت بايثون يدمج تقارير التذاكر الأسبوعية في تقرير Excel واحد، إلى جانب حل نحو 120 تذكرة دعم.", factIds: ["F3", "F4", "F6"] },
      { text: "في تنظيف البيانات: نظفت وحللت بيانات تجزئة عامة من 50,000 صف باستخدام بايثون (pandas)، وأحمل شهادة Google Data Analytics Professional Certificate (2025).", factIds: ["F11", "F12", "F15"] },
      { text: "أعمل بارتياح بالعربية والإنجليزية، وقدّمت جلسات تدريب أسبوعية على SQL وبايثون لطلاب السنة الأولى. أنا [[تأكد: مقيمة في الرياض أو مستعدة للانتقال]]، ويسعدني الحديث عن كيف أساعد مديري الفئات لديكم.", factIds: ["F16", "F17", "F8"] },
    ],
    closing: "مع خالص التحية،",
    signature: "Lama Abdullah",
  },
  tweaks: [
    "في وظائف البيانات، قدّمي مشروع لوحة مواعيد العيادات على التدريب.",
    "أضيفي نتيجة قابلة للقياس لمشروع اللوحة، مثل قرار دعمته.",
    "اكتبي مدينتك أو استعدادك للانتقال بجانب بيانات التواصل.",
    "ضعي Power BI وSQL في عنوان السيرة لتلتقطها أنظمة الفرز.",
  ],
  needsInput: [{ item: "الانتقال إلى الرياض", why: "الإعلان يشترط الإقامة في الرياض أو الاستعداد للانتقال إليها." }],
};

export function tailorDraft(lang: Lang): TailorDraft {
  return structuredClone(lang === "ar" ? AR : EN);
}

/** Fixture judge: flags the two deliberately wrong claims, passes the rest. */
export const TAILOR_VERDICT_OVERRIDES: Record<string, Record<Lang, { verdict: "partly" | "unsupported"; problem: string; fixedText: string | null }>> = {
  "cv.summary.2": {
    en: { verdict: "unsupported", problem: "Tableau and statistical modelling are not in the CV.", fixedText: null },
    ar: { verdict: "unsupported", problem: "لا يوجد Tableau ولا نمذجة إحصائية في السيرة.", fixedText: null },
  },
  "cv.experience.0.bullets.0": {
    en: {
      verdict: "partly",
      problem: "The CV doesn't say how much time the script saved.",
      fixedText: "Automated the weekly helpdesk report: wrote a Python script that merges ticket exports into one Excel file, saving [[confirm: hours saved per week]].",
    },
    ar: {
      verdict: "partly",
      problem: "السيرة لا تذكر مقدار الوقت الذي وفّره السكربت.",
      fixedText: "أتمتة تقرير الدعم الأسبوعي: كتابة سكربت بايثون يدمج تقارير التذاكر في ملف Excel واحد، وفّر [[تأكد: عدد الساعات أسبوعياً]].",
    },
  },
};
