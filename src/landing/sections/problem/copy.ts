/**
 * Default copy for the problem section, per product family and language.
 * Pains are [pain, fix] pairs: the pain is a concrete moment the shopper lives today, the fix the
 * concrete change the product brings (the "with" panel of the split view). Short and sensory.
 * French punctuation and figures like "11 h" use no-break spaces (U+00A0), so they never wrap apart.
 */
import { typo } from "../benefits/copy";
import type { CopyLang, Family, Tri } from "../benefits/kit";
import type { Garment } from "../garment";

export interface ProblemFamilyCopy {
  pains: readonly (readonly [string, string])[];
  /** the turn: one line that names the product (*{short}* gets the emphasis treatment) */
  solutions: readonly string[];
  /** one pain, said the way a customer would say it (quote view) */
  quote: string;
}

export interface ProblemCommonCopy {
  kickers: readonly string[];
  titles: readonly string[];
  lead: string;
  cite: string;
  notes: readonly string[];
  without: string;
  with: string;
}

/** Built-in microcopy of the chat view (not merchant content, so not in the schema). */
export interface ChatMicrocopy {
  online: string;
  today: string;
  /** muted text in the (decorative) message composer */
  placeholder: string;
  /** accessible name of the recreated conversation */
  label: string;
  /** header name when the store has no name yet (never the product as a person) */
  care: string;
  /** header status line then: a true fact instead of "online" */
  cod: string;
}

export const CHAT_UI: Tri<ChatMicrocopy> = {
  fr: { online: "En ligne", today: "Aujourd'hui", placeholder: "Votre message", label: "Conversation avec la boutique", care: "Service client", cod: "Paiement à la livraison" },
  ar: { online: "متصل الآن", today: "اليوم", placeholder: "اكتب رسالتك", label: "محادثة مع المتجر", care: "خدمة الزبناء", cod: "الدفع عند الاستلام" },
  en: { online: "Online", today: "Today", placeholder: "Message", label: "Conversation with the shop", care: "Customer care", cod: "Cash on delivery" },
};

export const COMMON: Tri<ProblemCommonCopy> = {
  fr: {
    kickers: ["Le problème", "Au quotidien", "Avant"],
    titles: ["Vous connaissez *ça*, non ?", "Ce qui vous *agace* au quotidien", "Ce que vous ne voulez *plus vivre*"],
    lead: "Si l'une de ces phrases vous parle, la suite est pour vous.",
    cite: "Une phrase qu'on entend souvent",
    notes: ["Fini, tout ça.", "Et maintenant ?"],
    without: "Sans",
    with: "Avec",
  },
  ar: {
    kickers: ["المشكلة", "كل يوم", "قبل"],
    titles: ["تعرف *هذا الإحساس*؟", "ما *يزعجك* كل يوم", "ما لم تعد *تريد* أن تعيشه"],
    lead: "إن كانت إحدى هذه الجمل تشبهك، فالباقي مكتوب لك.",
    cite: "جملة نسمعها كثيرًا",
    notes: ["انتهى كل هذا.", "والآن؟"],
    without: "بدونه",
    with: "مع",
  },
  en: {
    kickers: ["The problem", "Every day", "Before"],
    titles: ["Sound *familiar*?", "The little things that *wear you down*", "What you're *done putting up with*"],
    lead: "If any of these sounds like you, read on.",
    cite: "Something we hear a lot",
    notes: ["Not anymore.", "And now?"],
    without: "Without",
    with: "With",
  },
};

export const FAMILY_COPY: Record<Family, Tri<ProblemFamilyCopy>> = {
  care: {
    fr: {
      pains: [
        ["La peau qui tiraille dès 11 h du matin", "Une peau souple jusqu'au soir, en 3 gouttes"],
        ["Des crèmes chères qui laissent un film gras", "Absorbé en une minute, sans film gras"],
        ["Des pointes sèches, quoi que vous essayiez", "Des pointes nourries dès la première semaine"],
        ["Des étiquettes longues comme un roman", "Un seul ingrédient pur, d'origine connue"],
      ],
      solutions: [
        "Une routine plus courte, une peau plus calme : *{short}*.",
        "Trois gouttes le soir, une peau apaisée au réveil : *{short}*.",
      ],
      quote: "J'ai tout essayé, et le soir ma peau *tiraille encore*.",
    },
    ar: {
      pains: [
        ["بشرة تشدّ وتجفّ قبل منتصف النهار", "بشرة ليّنة حتى المساء بثلاث قطرات فقط"],
        ["كريمات غالية تترك الوجه لامعًا ودهنيًا", "يتشرّبه الجلد في دقيقة، بلا أي لمعة"],
        ["أطراف شعر جافة رغم كل محاولاتك", "أطراف مغذّاة من الأسبوع الأول"],
        ["مكوّنات طويلة لا تفهم منها شيئًا", "مكوّن واحد نقي، معروف المصدر"],
      ],
      solutions: ["روتين أقصر وبشرة أهدأ: *{short}*.", "ثلاث قطرات في المساء، وبشرة مرتاحة في الصباح: *{short}*."],
      quote: "جرّبت كل شيء، وفي الليل *ما زالت بشرتي تشدّ*.",
    },
    en: {
      pains: [
        ["Skin that feels tight by 11 a.m.", "Supple skin until evening, with 3 drops"],
        ["Pricey creams that leave a greasy film", "Sinks in within a minute, no film"],
        ["Dry ends, whatever you try", "Nourished ends from the first week"],
        ["Ingredient lists as long as a novel", "One pure ingredient you can trace"],
      ],
      solutions: ["A shorter routine, calmer skin: *{short}*.", "Three drops at night, calm skin by morning: *{short}*."],
      quote: "I've tried everything, and at night my skin *still feels tight*.",
    },
  },
  scent: {
    fr: {
      pains: [
        ["Un parfum qui s'évapore avant midi", "Un sillage qui tient du matin à la nuit"],
        ["Des copies qui sentent surtout l'alcool", "Un jus dense, sans piqûre d'alcool"],
        ["Payer le prix fort pour une étiquette", "Une qualité de niche, au prix juste"],
        ["Ne jamais savoir quoi offrir", "Un coffret prêt à offrir"],
      ],
      solutions: ["Un sillage qu'on remarque, et qui reste : *{short}*.", "Le parfum qu'on vous demande, du matin au soir : *{short}*."],
      quote: "On me complimente le matin, et le soir *il n'en reste rien*.",
    },
    ar: {
      pains: [
        ["عطر يتبخّر قبل الظهر", "رائحة تبقى من الصباح حتى الليل"],
        ["نسخ رخيصة لا تشمّ منها إلا الكحول", "تركيز عالٍ، بلا لسعة كحول"],
        ["تدفع الكثير مقابل الاسم فقط", "جودة راقية بسعر معقول"],
        ["حيرة دائمة في اختيار الهدية", "علبة أنيقة جاهزة للإهداء"],
      ],
      solutions: ["عطر يُلاحَظ ويبقى في الذاكرة: *{short}*.", "العطر الذي يسألونك عنه، من الصباح إلى المساء: *{short}*."],
      quote: "يمدحون رائحتي في الصباح، وفي المساء *لا يبقى شيء*.",
    },
    en: {
      pains: [
        ["A scent that's gone before lunch", "Lasts from morning to late night"],
        ["Copies that mostly smell of alcohol", "A dense juice with no alcohol sting"],
        ["Paying for the label, not the juice", "Niche quality at a fair price"],
        ["Never knowing what to gift", "Arrives gift-ready in its box"],
      ],
      solutions: ["A trail people notice, and remember: *{short}*.", "The scent people ask about, morning to night: *{short}*."],
      quote: "People compliment it in the morning; by evening *there's nothing left*.",
    },
  },
  style: {
    fr: {
      pains: [
        ["Des bijoux qui noircissent en un mois", "Une finition qui garde son éclat"],
        ["Des photos trop belles pour être vraies", "Vous voyez la pièce avant de payer"],
        ["Des pièces fragiles qui cassent au premier choc", "Des matières solides, faites pour durer"],
        ["Toujours la même tenue, sans le détail qui change tout", "La touche qui réveille une tenue simple"],
      ],
      solutions: ["Le détail qu'on remarque, sans le prix qui fait peur : *{short}*.", "Une tenue simple, un détail qui change tout : *{short}*."],
      quote: "Sur la photo c'était parfait. *En vrai, beaucoup moins.*",
    },
    ar: {
      pains: [
        ["إكسسوارات تسودّ من الشهر الأول", "بريق يدوم مع الوقت"],
        ["صور على الإنترنت أجمل من الحقيقة", "تعاين القطعة قبل أن تدفع"],
        ["قطع هشّة تنكسر من أول صدمة", "مواد متينة مصنوعة لتدوم"],
        ["الإطلالة نفسها دائمًا، بلا لمسة مختلفة", "اللمسة التي تغيّر الإطلالة كلها"],
      ],
      solutions: ["التفصيل الذي يُلاحَظ، بلا ثمن مبالغ فيه: *{short}*.", "إطلالة بسيطة، وتفصيل يغيّر كل شيء: *{short}*."],
      quote: "في الصورة كانت رائعة. *في الواقع، لا.*",
    },
    en: {
      pains: [
        ["Jewellery that tarnishes within a month", "A finish that keeps its shine"],
        ["Online photos that look too good to be true", "You see the piece before you pay"],
        ["Fragile pieces that break at the first knock", "Solid materials, made to last"],
        ["The same outfit, nothing to lift it", "The detail that lifts a simple look"],
      ],
      solutions: ["The detail people notice, without the scary price: *{short}*.", "A simple outfit, one detail that changes it: *{short}*."],
      quote: "In the photo it was perfect. *In real life, not so much.*",
    },
  },
  active: {
    fr: {
      pains: [
        ["Les jambes en béton après la séance", "Des muscles relâchés en 10 minutes"],
        ["Le dos noué après 8 h assis", "Des nœuds détendus, sans rendez-vous"],
        ["Des séances de kiné hors de prix", "Votre récupération à la maison, quand vous voulez"],
        ["Du matériel lourd qui finit au placard", "Compact, il vous suit à la salle"],
      ],
      solutions: ["Récupérez plus vite, entraînez-vous plus souvent : *{short}*.", "Dix minutes le soir, des jambes neuves le matin : *{short}*."],
      quote: "Deux jours après la séance, je marche encore *comme un robot*.",
    },
    ar: {
      pains: [
        ["ساقان كالحجر بعد التمرين", "عضلات مرتاحة في عشر دقائق"],
        ["ظهر متشنّج بعد 8 ساعات من الجلوس", "عُقد تنحلّ دون موعد"],
        ["حصص الترويض الطبي باهظة الثمن", "استرجاع في البيت، متى شئت"],
        ["أجهزة ثقيلة تبقى في الخزانة", "صغير، يرافقك إلى القاعة"],
      ],
      solutions: ["استرجاع أسرع، وتمارين أكثر: *{short}*.", "عشر دقائق في المساء، وساقان خفيفتان في الصباح: *{short}*."],
      quote: "يومان بعد التمرين، وما زلت *أمشي كالروبوت*.",
    },
    en: {
      pains: [
        ["Legs like concrete after training", "Muscles loosened in 10 minutes"],
        ["A knotted back after 8 hours of sitting", "Knots released, no appointment"],
        ["Physio sessions that cost a fortune", "Recovery at home, whenever you want"],
        ["Bulky gear that lives in the cupboard", "Compact enough for your gym bag"],
      ],
      solutions: ["Recover faster, train more often: *{short}*.", "Ten minutes at night, fresh legs by morning: *{short}*."],
      quote: "Two days after a session I still *walk like a robot*.",
    },
  },
  home: {
    fr: {
      pains: [
        ["Des appareils qui encombrent tout le plan de travail", "Compact, rangé en deux secondes"],
        ["Dix minutes de vaisselle pour deux minutes d'usage", "Se rince sous le robinet en 20 s"],
        ["Des fils et des prises partout", "Sans fil, rechargeable en USB"],
        ["Des produits qui lâchent après trois mois", "Des matériaux robustes, testés au quotidien"],
      ],
      solutions: ["Moins de corvées, plus de temps pour vous : *{short}*.", "Deux minutes, un rinçage, c'est rangé : *{short}*."],
      quote: "Je l'utilise deux minutes, et je *nettoie pendant dix*.",
    },
    ar: {
      pains: [
        ["أجهزة تملأ المطبخ كله", "صغير، يُخبَّأ في ثانيتين"],
        ["عشر دقائق من الغسل مقابل دقيقتين من الاستعمال", "يُغسل تحت الصنبور في عشرين ثانية"],
        ["أسلاك ومقابس في كل مكان", "بلا سلك، يُشحن عبر USB"],
        ["أدوات تتعطّل بعد ثلاثة أشهر", "مواد متينة، مجرَّبة كل يوم"],
      ],
      solutions: ["تعب أقل، ووقت أكثر لك: *{short}*.", "دقيقتان، شطفة ماء، وانتهى: *{short}*."],
      quote: "نستعمله دقيقتين، ونغسله *عشر دقائق*.",
    },
    en: {
      pains: [
        ["Appliances hogging the whole counter", "Compact, put away in two seconds"],
        ["Ten minutes of washing up for two minutes of use", "Rinses clean under the tap in 20 s"],
        ["Cables and plugs everywhere", "Cordless, recharges over USB"],
        ["Things that give up after three months", "Sturdy materials, tested daily"],
      ],
      solutions: ["Fewer chores, more time for you: *{short}*.", "Two minutes, one rinse, done: *{short}*."],
      quote: "I use it for two minutes and *clean for ten*.",
    },
  },
  tech: {
    fr: {
      pains: [
        ["Une batterie à plat au pire moment", "Une autonomie qui tient la journée"],
        ["Des gadgets compliqués, une notice illisible", "Prêt à l'emploi en une minute"],
        ["Du plastique qui chauffe et qui grince", "Un boîtier solide, des finitions nettes"],
        ["Personne à qui parler en cas de panne", "Un conseiller qui vous rappelle et vous guide"],
      ],
      solutions: ["La techno qui marche, tout simplement : *{short}*.", "On le branche, il marche, il dure : *{short}*."],
      quote: "Il a marché une semaine, *puis plus rien*.",
    },
    ar: {
      pains: [
        ["بطارية فارغة في أسوأ لحظة", "بطارية تكفي يومًا كاملًا"],
        ["أجهزة معقّدة ودليل لا يُقرأ", "جاهز للاستعمال في دقيقة"],
        ["بلاستيك يسخن ويصدر صريرًا", "هيكل متين وتشطيب نظيف"],
        ["لا أحد يجيبك إن تعطّل", "مستشار يتصل بك ويرشدك"],
      ],
      solutions: ["تقنية تعمل، ببساطة: *{short}*.", "تشغّله، يعمل، ويدوم: *{short}*."],
      quote: "اشتغل معي أسبوعًا، *ثم توقّف تمامًا*.",
    },
    en: {
      pains: [
        ["A flat battery at the worst moment", "Battery that lasts the whole day"],
        ["Complicated gadgets, an unreadable manual", "Ready to use in one minute"],
        ["Plastic that heats up and creaks", "Solid body, clean finish"],
        ["Nobody to call when it breaks", "An advisor who calls you back and guides you"],
      ],
      solutions: ["Tech that just works: *{short}*.", "Plug it in, it works, it lasts: *{short}*."],
      quote: "It worked for a week, *then nothing*.",
    },
  },
  kids: {
    fr: {
      pains: [
        ["Des jouets oubliés au bout de deux jours", "Un jeu qu'ils redemandent chaque soir"],
        ["Des petites pièces qui inquiètent", "Des bords arrondis, des matières sûres"],
        ["Les écrans, juste pour avoir la paix", "Ils jouent avec leurs mains, pas avec un écran"],
        ["Du plastique qui casse à la première chute", "Assez solide pour toutes les chutes"],
      ],
      solutions: ["Du jeu qui dure, et l'esprit tranquille : *{short}*.", "Moins d'écran, plus de rires : *{short}*."],
      quote: "Deux jours plus tard, le jouet est déjà *sous le lit*.",
    },
    ar: {
      pains: [
        ["ألعاب تُنسى بعد يومين", "لعبة يطلبونها كل مساء"],
        ["قطع صغيرة تقلقك", "حواف مستديرة ومواد آمنة"],
        ["الشاشة حلٌّ وحيد لترتاح قليلًا", "يلعبون بأيديهم، لا بالشاشة"],
        ["بلاستيك ينكسر من أول سقطة", "متينة وتتحمّل السقطات"],
      ],
      solutions: ["لعب يدوم، وبال مرتاح: *{short}*.", "شاشة أقل، وضحك أكثر: *{short}*."],
      quote: "بعد يومين، تكون اللعبة *تحت السرير*.",
    },
    en: {
      pains: [
        ["Toys forgotten after two days", "A game they ask for every night"],
        ["Small parts that make you nervous", "Rounded edges, safe materials"],
        ["Screens, just to get some peace", "Hands-on play, not screen time"],
        ["Plastic that breaks at the first fall", "Tough enough for every tumble"],
      ],
      solutions: ["Play that lasts, and peace of mind: *{short}*.", "Less screen, more laughs: *{short}*."],
      quote: "Two days later the toy is already *under the bed*.",
    },
  },
  natural: {
    fr: {
      pains: [
        ["Du « bio » venu d'on ne sait où", "Une origine claire, du producteur à vous"],
        ["Le goût fade des produits industriels", "Le vrai goût, comme à la maison"],
        ["Des additifs aux noms imprononçables", "Une liste d'ingrédients courte et lisible"],
        ["Payer cher en boutique spécialisée", "Le prix direct de la coopérative"],
      ],
      solutions: ["Le vrai, sans détour : *{short}*.", "Du producteur à votre table, rien entre les deux : *{short}*."],
      quote: "C'est écrit naturel sur l'étiquette, mais *d'où ça vient* vraiment ?",
    },
    ar: {
      pains: [
        ["منتجات «بيو» لا يُعرف مصدرها", "مصدر واضح، من المنتِج إليك"],
        ["مذاق باهت كمذاق المصانع", "المذاق الحقيقي، كأنه من صنع البيت"],
        ["مواد مضافة بأسماء غريبة", "مكوّنات قليلة وواضحة"],
        ["أسعار مرتفعة في المحلات", "سعر مباشر من التعاونية"],
      ],
      solutions: ["الأصلي، بلا لفّ ولا دوران: *{short}*.", "من المنتِج إلى مائدتك، بلا وسيط: *{short}*."],
      quote: "مكتوب «طبيعي» على الملصق، لكن *من أين جاء* حقًا؟",
    },
    en: {
      pains: [
        ["“Organic” from who knows where", "Clear origin, from producer to you"],
        ["The flat taste of factory products", "The real taste, like homemade"],
        ["Additives with unpronounceable names", "A short, readable ingredient list"],
        ["Paying a premium in specialty shops", "The cooperative's direct price"],
      ],
      solutions: ["The real thing, no detours: *{short}*.", "From the producer to your table, nothing in between: *{short}*."],
      quote: "It says natural on the label, but *where does it really come from?*",
    },
  },
  general: {
    fr: {
      pains: [
        ["Des achats en ligne qui déçoivent à l'arrivée", "Vous vérifiez avant de payer"],
        ["Des produits qui lâchent au bout d'un mois", "Une qualité testée au quotidien"],
        ["Payer d'avance sans savoir ce qui arrive", "Paiement à la livraison, rien avant"],
        ["Personne à qui parler en cas de souci", "Une vraie personne au téléphone"],
      ],
      solutions: ["Simple, solide, livré chez vous : *{short}*.", "Vous le voyez, vous le touchez, puis vous payez : *{short}*."],
      quote: "J'ai payé d'avance, et ce n'était *pas du tout pareil*.",
    },
    ar: {
      pains: [
        ["سلعة من الإنترنت تخيّب الظن عند وصولها", "تعاين السلعة قبل أن تدفع"],
        ["أشياء تتعطّل بعد شهر", "جودة مجرَّبة في الاستعمال اليومي"],
        ["تدفع قبل أن تعرف ما سيصلك", "الدفع عند الاستلام، لا شيء قبله"],
        ["لا أحد تكلّمه إن حدث مشكل", "شخص حقيقي على الهاتف"],
      ],
      solutions: ["بسيط، متين، ويصل إلى باب بيتك: *{short}*.", "تراه، تلمسه، ثم تدفع: *{short}*."],
      quote: "دفعت مسبقًا، ولم يكن *مثل الصورة* إطلاقًا.",
    },
    en: {
      pains: [
        ["Online buys that disappoint on arrival", "You check before you pay"],
        ["Products that give up after a month", "Quality tested in daily use"],
        ["Paying upfront without knowing what's coming", "Cash on delivery, nothing before"],
        ["No one to talk to when there's an issue", "A real person on the phone"],
      ],
      solutions: ["Simple, solid, delivered to your door: *{short}*.", "See it, hold it, then pay: *{short}*."],
      quote: "I paid upfront and it was *nothing like the photo*.",
    },
  },
};

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts)                                            */
/* ------------------------------------------------------------------ */

type PainPair = readonly [string, string];

interface GarmentProblemCopy {
  shape: { prayer: PainPair; modest: PainPair; drape: PainPair; plain: PainPair };
  fabric: PainPair;
  kids: { girl: PainPair; boy: PainPair; child: PainPair };
  wash: PainPair;
  size: PainPair;
  solutions: { prayer: readonly string[]; modest: readonly string[]; plain: readonly string[] };
  quote: { prayer: string; drape: string; plain: string };
}

const GARMENT_PAINS: Tri<GarmentProblemCopy> = {
  fr: {
    shape: {
      prayer: ["Une tenue qui remonte ou qui serre au moment de la prière", "Ample et couvrante, du premier au dernier mouvement"],
      modest: ["Des pièces « couvrantes » qui serrent et engoncent", "Ample, couvrante, et libre de bouger"],
      drape: ["Un voile qui glisse et qu'on réajuste toute la journée", "Un tissu qui tient en place, sans épingles en trop"],
      plain: ["Une coupe qui tombe mal une fois portée", "Une coupe pensée pour bien tomber"],
    },
    fabric: ["Un tissu qui gratte ou qui colle quand il fait chaud", "Un tissu doux qui laisse respirer"],
    kids: {
      girl: ["Une petite qui tire sur sa tenue toute la journée", "Légère et douce : elle l'oublie et bouge librement"],
      boy: ["Un petit qui tire sur ses vêtements toute la journée", "Léger et doux : il l'oublie et bouge librement"],
      child: ["Un enfant qui tire sur ses vêtements toute la journée", "Léger et doux : votre enfant l'oublie et bouge librement"],
    },
    wash: ["Des vêtements qui se déforment après trois lavages", "Coutures nettes, une pièce qui garde sa forme"],
    size: ["Une taille commandée en ligne qui ne tombe jamais juste", "Taille revue avec vous au téléphone, vérifiée avant de payer"],
    solutions: {
      prayer: ["Ample, douce, pensée pour la prière : *{short}*.", "Cinq prières par jour, une tenue qui ne gêne jamais : *{short}*."],
      modest: ["Couvrir sans encombrer : *{short}*.", "Ample, douce, facile à vivre : *{short}*."],
      plain: ["Douce à porter, juste dans la coupe : *{short}*.", "La pièce qu'on enfile sans y penser, et qu'on garde : *{short}*."],
    },
    quote: {
      prayer: "À chaque prosternation, *je réajustais ma tenue*.",
      drape: "Je passais ma journée *à le remettre en place*.",
      plain: "Sur la photo, le tissu avait l'air beau. *En vrai, il grattait.*",
    },
  },
  ar: {
    shape: {
      prayer: ["لباس يرتفع أو يضيق في وقت الصلاة", "واسعة وساترة، من أول حركة إلى آخرها"],
      modest: ["قطع «ساترة» تضيق وتُثقل الحركة", "واسعة وساترة، وحرية في الحركة"],
      drape: ["حجاب ينزلق ويحتاج إلى ضبط طوال اليوم", "قماش يثبت في مكانه دون دبابيس كثيرة"],
      plain: ["قصّة لا تنسدل كما يجب عند اللبس", "قصّة مدروسة تنسدل بشكل جميل"],
    },
    fabric: ["قماش يحكّ أو يلتصق بالجسم في الحرّ", "قماش ناعم يترك الجسم يتنفّس"],
    kids: {
      girl: ["صغيرة تشدّ ثيابها طوال اليوم", "خفيفة وناعمة: تنساها وتتحرّك بحرية"],
      boy: ["صغير يشدّ ثيابه طوال اليوم", "خفيفة وناعمة: ينساها ويتحرّك بحرية"],
      child: ["طفل يشدّ ثيابه طوال اليوم", "خفيفة وناعمة: ينساها طفلك ويتحرّك بحرية"],
    },
    wash: ["ثياب تفقد شكلها بعد ثلاث غسلات", "خياطة متقنة، وقطعة تحافظ على شكلها"],
    size: ["مقاس من الإنترنت لا يأتي مضبوطًا أبدًا", "مقاس نراجعه معك بالهاتف، وتعاينه قبل الدفع"],
    solutions: {
      prayer: ["واسعة، ناعمة، ومصمَّمة للصلاة: *{short}*.", "خمس صلوات في اليوم، ولباس لا يزعجك أبدًا: *{short}*."],
      modest: ["ستر بلا تكلّف: *{short}*.", "واسعة وناعمة وسهلة في يومك: *{short}*."],
      plain: ["ناعمة في اللبس، مضبوطة في القصّة: *{short}*.", "قطعة تلبسها دون تفكير، وتحتفظ بها طويلًا: *{short}*."],
    },
    quote: {
      prayer: "في كل سجدة، *كنت أعدّل لباسي من جديد*.",
      drape: "كنت أقضي يومي *في إعادة ضبطه*.",
      plain: "في الصورة كان القماش جميلًا. *في الواقع، كان يحكّ*.",
    },
  },
  en: {
    shape: {
      prayer: ["Clothes that ride up or pinch during prayer", "Loose and covering, from the first move to the last"],
      modest: ["“Modest” pieces that feel tight and stiff", "Loose, covering, and free to move"],
      drape: ["A veil that slips and needs fixing all day", "A fabric that stays put, without a handful of pins"],
      plain: ["A cut that falls wrong once it's on", "A cut designed to fall right"],
    },
    fabric: ["Fabric that itches or clings in the heat", "A soft fabric that lets you breathe"],
    kids: {
      girl: ["A little girl tugging at her clothes all day", "Light and soft: she forgets it and moves freely"],
      boy: ["A little boy tugging at his clothes all day", "Light and soft: he forgets it and moves freely"],
      child: ["A child tugging at their clothes all day", "Light and soft: they forget it and move freely"],
    },
    wash: ["Clothes that lose their shape after three washes", "Clean seams, a piece that keeps its shape"],
    size: ["A size ordered online that never fits right", "Size checked with you by phone, and before you pay"],
    solutions: {
      prayer: ["Loose, soft, made for prayer: *{short}*.", "Five prayers a day, an outfit that never gets in the way: *{short}*."],
      modest: ["Covered, never weighed down: *{short}*.", "Loose, soft, easy to live in: *{short}*."],
      plain: ["Soft to wear, right in the cut: *{short}*.", "The piece you put on without thinking, and keep: *{short}*."],
    },
    quote: {
      prayer: "Every time I bowed, *I had to fix my clothes again*.",
      drape: "I spent the whole day *putting it back in place*.",
      plain: "In the photo the fabric looked lovely. *In real life, it itched.*",
    },
  },
};

/**
 * The pains a garment ends: its shape (prayer, modest, a slipping veil, a bad cut), the fabric, a
 * child tugging at clothes (or clothes that lose their shape), and a size bought blind.
 */
export function garmentProblem(lang: CopyLang, g: Garment): ProblemFamilyCopy {
  const c = GARMENT_PAINS[lang];
  const shape = g.scarf ? c.shape.drape : g.prayer ? c.shape.prayer : g.modest ? c.shape.modest : c.shape.plain;
  const third = g.kids && !g.scarf ? c.kids[g.kids] : c.wash;
  // French typography (no-break spaces before ":" and inside « »), like the hand-set lines above
  const t = (s: string) => typo(lang, s);
  const pairs: PainPair[] = [shape, c.fabric, third, ...(g.scarf ? [] : [c.size])];
  return {
    pains: pairs.map(([pain, fix]) => [t(pain), t(fix)] as const),
    solutions: (g.prayer ? c.solutions.prayer : g.modest ? c.solutions.modest : c.solutions.plain).map(t),
    quote: t(g.scarf ? c.quote.drape : g.prayer ? c.quote.prayer : c.quote.plain),
  };
}
