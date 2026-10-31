export type Lang = "en" | "bn";

const dict = {
  appName: { en: "RoktoDoot", bn: "রক্তদূত" },
  tagline: {
    en: "Describe the need the way you would text a friend. We find nearby donors and contact them for you.",
    bn: "বন্ধুকে যেভাবে লিখতেন সেভাবে লিখুন। আমরা কাছের রক্তদাতাদের খুঁজে আপনার হয়ে যোগাযোগ করব।",
  },
  needBlood: { en: "Who needs blood, and where?", bn: "কার রক্ত লাগবে, কোথায়?" },
  placeholder: { en: "Dhaka Medical e O+ lagbe, 2 bag, aj raate", bn: "ঢাকা মেডিকেলে ও পজিটিভ ২ ব্যাগ, আজ রাতে" },
  findDonors: { en: "Find donors", bn: "রক্তদাতা খুঁজুন" },
  useForm: { en: "Fill a form instead", bn: "ফর্ম পূরণ করুন" },
  useText: { en: "Type it instead", bn: "লিখে জানান" },
  beDonor: { en: "Register as a donor", bn: "রক্তদাতা হিসেবে নিবন্ধন" },
  navHome: { en: "Home", bn: "হোম" },
  navDonate: { en: "Donate", bn: "রক্তদান" },
  myRequests: { en: "Requests", bn: "অনুরোধ" },
  inbox: { en: "Donor inbox", bn: "রক্তদাতার ইনবক্স" },
  profile: { en: "Donor profile", bn: "রক্তদাতার প্রোফাইল" },
  admin: { en: "Admin", bn: "অ্যাডমিন" },
  alerts: { en: "Alerts", bn: "বার্তা" },
  signIn: { en: "Sign in", bn: "সাইন ইন" },
  signOut: { en: "Sign out", bn: "সাইন আউট" },
  signInGoogle: { en: "Continue with Google", bn: "Google দিয়ে চালিয়ে যান" },
  checkDetails: { en: "Check the details", bn: "তথ্যগুলো যাচাই করুন" },
  checkHint: {
    en: "This is what we understood. Fix anything that is wrong before we contact donors.",
    bn: "আমরা যা বুঝেছি তা নিচে দেওয়া হলো। রক্তদাতাদের জানানোর আগে ভুল থাকলে ঠিক করুন।",
  },
  bloodGroup: { en: "Blood group", bn: "রক্তের গ্রুপ" },
  bags: { en: "Bags", bn: "ব্যাগ" },
  bag: { en: "bag", bn: "ব্যাগ" },
  bagsLower: { en: "bags", bn: "ব্যাগ" },
  hospital: { en: "Hospital", bn: "হাসপাতাল" },
  neededBy: { en: "Needed by", bn: "কখন লাগবে" },
  urgency: { en: "Urgency", bn: "জরুরি অবস্থা" },
  normal: { en: "Normal", bn: "সাধারণ" },
  critical: { en: "Critical", bn: "অতি জরুরি" },
  contactPhone: { en: "Phone for the donor to call", bn: "রক্তদাতা যে নম্বরে ফোন করবেন" },
  confirmSend: { en: "Confirm and contact donors", bn: "নিশ্চিত করুন ও রক্তদাতাদের জানান" },
  cancelRequest: { en: "Cancel request", bn: "অনুরোধ বাতিল" },
  donationDone: { en: "Blood received", bn: "রক্ত পাওয়া গেছে" },
  accept: { en: "I can donate", bn: "আমি দিতে পারব" },
  decline: { en: "Not this time", bn: "এবার পারছি না" },
  available: { en: "Available to donate", bn: "রক্ত দিতে প্রস্তুত" },
  paused: { en: "Paused", bn: "বিরতিতে" },
  save: { en: "Save profile", bn: "প্রোফাইল সংরক্ষণ" },
  deleteData: { en: "Delete my donor data", bn: "আমার তথ্য মুছে ফেলুন" },
  nextWaveIn: { en: "Next wave in", bn: "পরের ধাপ" },
  timeline: { en: "What the system has done", bn: "সিস্টেম যা করেছে" },
  bloodBanks: { en: "Nearest blood banks", bn: "কাছের ব্লাড ব্যাংক" },
  donorFound: { en: "A donor is on the way", bn: "একজন রক্তদাতা রাজি হয়েছেন" },
  callDonor: { en: "Call the donor", bn: "রক্তদাতাকে ফোন করুন" },
  heldReview: { en: "A volunteer is checking this request", bn: "একজন স্বেচ্ছাসেবক অনুরোধটি যাচাই করছেন" },
  howTitle: { en: "What happens after you send it", bn: "পাঠানোর পর যা হয়" },
  how1: { en: "You check what we understood and fix anything wrong.", bn: "আমরা যা বুঝেছি তা আপনি দেখে নেবেন, ভুল থাকলে ঠিক করবেন।" },
  how2: {
    en: "We contact the five closest donors who can give your group and are rested enough to donate.",
    bn: "আপনার গ্রুপে রক্ত দিতে পারেন এবং বিশ্রাম শেষ হয়েছে, এমন সবচেয়ে কাছের পাঁচজনকে আমরা জানাই।",
  },
  how3: {
    en: "If nobody answers in time, we widen the search to 10 km, then 25 km, then list blood banks.",
    bn: "সময়মতো কেউ সাড়া না দিলে ১০ কিমি, তারপর ২৫ কিমি পর্যন্ত খুঁজি, শেষে ব্লাড ব্যাংকের তালিকা দেখাই।",
  },
  how4: {
    en: "When a donor says yes, you get their phone number. You can watch every step on a map.",
    bn: "কোনো রক্তদাতা রাজি হলে আপনি তাঁর ফোন নম্বর পাবেন। প্রতিটি ধাপ মানচিত্রে দেখতে পাবেন।",
  },
  donorPitch: {
    en: "Can you give blood? Donors are only contacted when they are nearby and ready.",
    bn: "আপনি কি রক্ত দিতে পারেন? কাছে থাকলে এবং প্রস্তুত থাকলেই শুধু আপনাকে জানানো হবে।",
  },
  notMedical: {
    en: "RoktoDoot coordinates volunteers. It is not medical advice.",
    bn: "রক্তদূত স্বেচ্ছাসেবকদের সমন্বয় করে। এটি চিকিৎসা পরামর্শ নয়।",
  },
} satisfies Record<string, Record<Lang, string>>;

export type MsgKey = keyof typeof dict;

export function translate(key: MsgKey, lang: Lang): string {
  return dict[key][lang];
}

export const STATUS_TEXT: Record<string, Record<Lang, string>> = {
  PARSED: { en: "Waiting for your confirmation", bn: "আপনার নিশ্চিতকরণের অপেক্ষায়" },
  HELD: { en: "Being checked by a volunteer", bn: "স্বেচ্ছাসেবক যাচাই করছেন" },
  REJECTED: { en: "Not published", bn: "প্রকাশ করা হয়নি" },
  WAVE_1: { en: "Contacting the closest donors (5 km)", bn: "সবচেয়ে কাছের রক্তদাতাদের জানানো হচ্ছে (৫ কিমি)" },
  WAVE_2: { en: "Widening the search to 10 km", bn: "১০ কিমি পর্যন্ত খোঁজা হচ্ছে" },
  WAVE_3: { en: "Contacting every eligible donor within 25 km", bn: "২৫ কিমির সব রক্তদাতাকে জানানো হচ্ছে" },
  BANK_FALLBACK: { en: "No donor yet. Call a blood bank below", bn: "এখনো রক্তদাতা মেলেনি। নিচের ব্লাড ব্যাংকে ফোন করুন" },
  ACCEPTED: { en: "Donor found", bn: "রক্তদাতা পাওয়া গেছে" },
  FULFILLED: { en: "Done. Blood received", bn: "সম্পন্ন। রক্ত পাওয়া গেছে" },
  CANCELLED: { en: "Cancelled", bn: "বাতিল" },
  EXPIRED: { en: "Closed after 24 hours", bn: "২৪ ঘণ্টা পর বন্ধ" },
};
