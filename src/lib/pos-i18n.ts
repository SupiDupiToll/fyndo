export type PosLang = "de" | "zh";

const de = {
  // Header
  tagline: "Tippen & Bestellen",
  settings: "Einstellungen",
  soundOff: "Ton aus",
  soundOn: "Ton an",
  clearAll: "Alles Löschen",
  clearAllLower: "Alles löschen",
  articles: "{count} Artikel",
  cartOpened: "Ihr Warenkorb.",
  fromPrice: "ab {price}",
  variants: "{count} Varianten",
  qtyDecrease: "Menge verringern",
  qtyIncrease: "Menge erhöhen",
  qtyDecreaseNamed: "{name} verringern",
  qtyIncreaseNamed: "{name} erhöhen",
  noProducts: "Keine Produkte verfügbar.",
  emptyCartShort: "Warenkorb ist leer",
  payNow: "Jetzt bezahlen",

  // Container selection
  chooseContainers: "Wähle deine Becher & Schüsseln",
  chooseContainersHint:
    "Tippe, wie viele Becher oder Schüsseln du möchtest. Danach wählst du für jeden die Kugeln.",
  chosen: "Gewählt",
  chooseContainerCta: "Bitte Becher oder Schüssel wählen",
  nextScoops: "Weiter: Kugeln wählen",
  extrasAndPay: "Extras & bezahlen",
  nextExtras: "Weiter: Extras & {label}",
  back: "Zurück",
  active: "aktiv",
  buildHintLast:
    "Tippe die Kugeln für diesen Becher. Danach kannst du direkt bezahlen.",
  buildHint: "Tippe die Kugeln für diesen Becher.",
  noScoops: "Keine Kugeln verfügbar.",

  // Idle countdown
  idleTitle: "Noch da?",
  idleHint:
    "Der Bildschirm sperrt sich gleich. Tippe auf „Ich bin noch hier“, um weiterzubestellen.",
  idleStay: "Ich bin noch hier",

  // Variant picker
  chooseVariant: "Wähle eine Variante",
  close: "Schließen",

  // Toppings
  extras: "Extras",
  toppingsTitle: "Noch etwas dazu?",
  toppingsVariantHint: "Tippen Sie auf eine Variante, um sie hinzuzufügen.",
  backToExtras: "Zurück zu den Extras",
  extrasSelected: "{count} extra",
  noExtrasSelected: "Keine Extras ausgewählt",
  noThanks: "Nein Danke",
  continueWithToppings: "Mit Toppings fortfahren",

  // Order summary
  orderOverview: "Bestellübersicht",
  pleaseReview: "Bitte prüfen",
  continueOrdering: "Weiter bestellen",
  cartEmptyTitle: "Ihr Warenkorb ist leer",
  cartEmptyHint:
    "Fügen Sie zuerst ein Produkt hinzu, dann erscheint es hier.",
  extraBadge: "Extra",
  total: "Summe",
  goToPayment: "Weiter zur Bezahlung",

  // Cart drawer
  yourCart: "Ihr Warenkorb",
  cartEmpty: "Ihr Warenkorb ist leer.",
  remove: "Entfernen",

  // Checkout
  orderNumber: "Bestellnummer #{number}",
  payment: "Bezahlung",
  yourNumber: "Ihre Nummer",
  assigningNumber: "Bestellnummer wird vergeben…",
  orderStartFailed: "Die Bestellung konnte nicht gestartet werden.",
  retry: "Erneut versuchen",
  minAmount: "Erst ab {amount} möglich",

  // Payment methods
  methodRbankTitle: "RBank",
  methodRbankSub: "Direkt am Bildschirm bezahlen",
  methodTippieTitle: "PayPal / Apple Pay / Karte",
  methodTippieSub: "QR-Code scannen & online zahlen",
  methodTerminalTitle: "Kartenterminal",
  methodTerminalSub: "Karte an das Terminal halten",
  methodCashTitle: "Bar",
  methodCashSub: "Betrag an der Kasse bezahlen",
  methodGiftTitle: "Fyndo-Gutschein",
  methodGiftSub: "Mit Gutschein ganz oder teilweise zahlen",

  // Gift card
  giftCodeRequired: "Bitte einen Gutscheincode eingeben.",
  giftRedeemed: "Gutschein eingelöst",
  giftDeducted: "{amount} abgezogen",
  remainingAmount: "Restbetrag",
  confirming: "Wird bestätigt…",
  completeOrder: "Bestellung abschließen",
  payRemainingWith: "Restbetrag bezahlen mit",
  redeemAnother: "Weiteren Gutschein einlösen",
  enterGiftCode: "Gutscheincode eingeben",
  giftAlreadyApplied: "{amount} wurden bereits abgezogen.",
  giftCovers: "Deckt den Betrag von {amount} ganz oder teilweise ab.",
  checking: "Prüfe…",
  redeem: "Einlösen",
  giftHint:
    "Geben Sie den Code vom Fyndo-Gutschein ein. Der Betrag wird direkt von Ihrer Bestellung abgezogen.",

  // RBank / QR
  checkoutLoadFailed: "Checkout konnte nicht geladen werden.",
  loadingCheckout: "Lädt Checkout…",
  rbankEmbedHint:
    "Bezahlen Sie direkt am Bildschirm. Die Bestellung wird automatisch bestätigt.",
  waitingPayment: "Warte auf Zahlung…",
  loadingQr: "Lädt QR-Code…",
  rbankQrHint:
    "Mit dem Handy scannen und direkt mit RBank bezahlen. Die Bestellung wird automatisch bestätigt.",
  tippieQrHint:
    "Mit dem Handy scannen und mit PayPal, Apple Pay oder Karte bezahlen.",
  waitingConfirmation: "Warte auf Bezahlung und Bestätigung…",

  // Terminal
  terminalCalled: "Terminal ausgerufen",
  terminalHint:
    "Das Kartenterminal ist aktiviert. Karte bereit halten und an das Terminal halten.",

  // Cash
  cashHint:
    "Bitte im Geschäft abholen und an der Kasse bezahlen. Sobald Sie bestätigen, wird Ihre Bestellung an den Marktstand übertragen.",
  sending: "Wird gesendet…",
  payAtPickup: "Beim Abholen bezahlen",

  // Success
  thanks: "Danke!",
  orderPlaced: "Ihre Bestellung ist raus.",
  newOrder: "Neue Bestellung",

  // Errors
  orderStartError: "Bestellung konnte nicht gestartet werden.",
  paymentStartFailed: "Zahlungsstart fehlgeschlagen.",
  confirmFailed: "Bestätigung fehlgeschlagen.",
  giftRedeemFailed: "Gutschein konnte nicht eingelöst werden.",

  // Lock screen
  startOrder: "Jetzt bestellen",
  tapToStart: "Tippen Sie auf den Bildschirm, um zu starten",

  // Spoken announcements
  sayWelcomeContainers:
    "Willkommen bei {vendor}. Wählen Sie zuerst Ihre Becher oder Schüsseln.",
  sayWelcome: "Willkommen bei {vendor}. Wählen Sie Ihre Produkte.",
  sayIdle:
    "Der Bildschirm wird gleich gesperrt. Wenn Sie noch da sind, tippen Sie auf Ich bin noch hier.",
  sayAdded: "{label}, {price}.",
  sayRemoved: "{label} entfernt.",
  sayContainerAdded: "{label} hinzugefügt.",
  sayContainerScoops: "{label}. Wählen Sie Ihre Kugeln.",
  sayChooseVariant: "{product}. Bitte Größe oder Variante wählen.",
  sayToppings:
    "Noch etwas dazu? Wählen Sie Ihre Toppings oder tippen Sie auf Nein Danke.",
  sayToppingsContainer:
    "{label}. Noch etwas dazu? Wählen Sie Ihre Toppings oder tippen Sie auf Nein Danke.",
  sayCheckout: "Zur Kasse. Bitte prüfen Sie Ihre Bestellung.",
  sayAssigning: "Zur Kasse. Ihre Bestellnummer wird gerade vergeben.",
  sayNewOrder: "Neue Bestellung. Wählen Sie Ihre Produkte.",
  sayOrderNumber: "Ihre Bestellnummer ist {number}.",
  sayGiftCode: "Fyndo-Gutschein. Bitte geben Sie den Gutscheincode ein.",
  sayRbankQr:
    "Bitte scannen Sie den QR-Code und bezahlen Sie mit RBank. Ihre Nummer ist {number}.",
  sayRbankEmbed:
    "Bitte bezahlen Sie direkt am Bildschirm. Ihre Nummer ist {number}.",
  sayTippie:
    "Bitte scannen Sie den QR-Code und zahlen Sie {amount} mit PayPal, Apple Pay oder Karte. Ihre Nummer ist {number}.",
  sayTerminal:
    "Kartenzahlung. Das Terminal wird aufgerufen. Bitte halten Sie Ihre Karte an das Terminal.",
  sayCash:
    "Bitte zahlen Sie {amount} in bar an der Kasse. Ihre Nummer ist {number}.",
  sayGiftNumber:
    "Bitte geben Sie den Gutscheincode ein. Ihre Nummer ist {number}.",
  sayConfirmed:
    "Vielen Dank! Ihre Bestellung ist raus. Ihre Nummer ist {number}.",
} as const;

export type PosTranslationKey = keyof typeof de;

const zh: Record<PosTranslationKey, string> = {
  // Header
  tagline: "点击下单",
  settings: "设置",
  soundOff: "关闭声音",
  soundOn: "开启声音",
  clearAll: "全部清空",
  clearAllLower: "全部清空",
  articles: "{count} 件商品",
  cartOpened: "您的购物车。",
  fromPrice: "{price} 起",
  variants: "{count} 种规格",
  qtyDecrease: "减少数量",
  qtyIncrease: "增加数量",
  qtyDecreaseNamed: "减少 {name}",
  qtyIncreaseNamed: "增加 {name}",
  noProducts: "暂无商品。",
  emptyCartShort: "购物车是空的",
  payNow: "立即支付",

  // Container selection
  chooseContainers: "选择您的杯子和碗",
  chooseContainersHint:
    "请选择需要的杯子或碗数量，然后为每一份选择冰淇淋球。",
  chosen: "已选",
  chooseContainerCta: "请选择杯子或碗",
  nextScoops: "下一步：选择冰淇淋球",
  extrasAndPay: "配料与支付",
  nextExtras: "下一步：配料与 {label}",
  back: "返回",
  active: "当前",
  buildHintLast: "请为这个杯子选择冰淇淋球，然后即可直接支付。",
  buildHint: "请为这个杯子选择冰淇淋球。",
  noScoops: "暂无可选的冰淇淋球。",

  // Idle countdown
  idleTitle: "还在吗？",
  idleHint: "屏幕即将锁定。点击“我还在这里”继续下单。",
  idleStay: "我还在这里",

  // Variant picker
  chooseVariant: "请选择规格",
  close: "关闭",

  // Toppings
  extras: "配料",
  toppingsTitle: "还要加点什么吗？",
  toppingsVariantHint: "点击规格即可添加。",
  backToExtras: "返回配料",
  extrasSelected: "{count} 份配料",
  noExtrasSelected: "未选择配料",
  noThanks: "不用了，谢谢",
  continueWithToppings: "确认配料并继续",

  // Order summary
  orderOverview: "订单概览",
  pleaseReview: "请确认",
  continueOrdering: "继续下单",
  cartEmptyTitle: "您的购物车是空的",
  cartEmptyHint: "请先添加商品，它会显示在这里。",
  extraBadge: "加料",
  total: "合计",
  goToPayment: "去支付",

  // Cart drawer
  yourCart: "您的购物车",
  cartEmpty: "您的购物车是空的。",
  remove: "移除",

  // Checkout
  orderNumber: "订单号 #{number}",
  payment: "支付",
  yourNumber: "您的取餐号",
  assigningNumber: "正在分配订单号…",
  orderStartFailed: "无法开始订单。",
  retry: "重试",
  minAmount: "{amount} 起可用",

  // Payment methods
  methodRbankTitle: "RBank",
  methodRbankSub: "直接在屏幕上支付",
  methodTippieTitle: "PayPal / Apple Pay / 银行卡",
  methodTippieSub: "扫描二维码并在线支付",
  methodTerminalTitle: "刷卡终端",
  methodTerminalSub: "将银行卡贴近终端",
  methodCashTitle: "现金",
  methodCashSub: "在收银台付款",
  methodGiftTitle: "Fyndo 代金券",
  methodGiftSub: "可使用代金券全额或部分支付",

  // Gift card
  giftCodeRequired: "请输入代金券代码。",
  giftRedeemed: "代金券已使用",
  giftDeducted: "已抵扣 {amount}",
  remainingAmount: "剩余金额",
  confirming: "正在确认…",
  completeOrder: "完成订单",
  payRemainingWith: "剩余金额支付方式",
  redeemAnother: "使用另一张代金券",
  enterGiftCode: "输入代金券代码",
  giftAlreadyApplied: "已抵扣 {amount}。",
  giftCovers: "可全额或部分抵扣 {amount}。",
  checking: "检查中…",
  redeem: "使用",
  giftHint: "请输入 Fyndo 代金券上的代码，金额将直接从订单中扣除。",

  // RBank / QR
  checkoutLoadFailed: "无法加载支付页面。",
  loadingCheckout: "正在加载支付页面…",
  rbankEmbedHint: "请直接在屏幕上支付，订单将自动确认。",
  waitingPayment: "等待支付…",
  loadingQr: "正在加载二维码…",
  rbankQrHint: "请用手机扫码并使用 RBank 支付，订单将自动确认。",
  tippieQrHint: "请用手机扫码，使用 PayPal、Apple Pay 或银行卡支付。",
  waitingConfirmation: "等待支付与确认…",

  // Terminal
  terminalCalled: "终端已就绪",
  terminalHint: "刷卡终端已激活，请准备好银行卡并贴近终端。",

  // Cash
  cashHint: "请到店取货并在收银台付款。确认后订单将发送到摊位。",
  sending: "正在发送…",
  payAtPickup: "取货时付款",

  // Success
  thanks: "谢谢！",
  orderPlaced: "您的订单已提交。",
  newOrder: "新订单",

  // Errors
  orderStartError: "无法开始订单。",
  paymentStartFailed: "启动支付失败。",
  confirmFailed: "确认失败。",
  giftRedeemFailed: "无法使用代金券。",

  // Lock screen
  startOrder: "立即下单",
  tapToStart: "点击屏幕开始",

  // Spoken announcements
  sayWelcomeContainers: "欢迎光临 {vendor}。请先选择您的杯子或碗。",
  sayWelcome: "欢迎光临 {vendor}。请选择您的商品。",
  sayIdle: "屏幕即将锁定。如果您还在，请点击“我还在这里”。",
  sayAdded: "{label}，{price}。",
  sayRemoved: "已移除 {label}。",
  sayContainerAdded: "已添加 {label}。",
  sayContainerScoops: "{label}。请选择冰淇淋球。",
  sayChooseVariant: "{product}。请选择规格。",
  sayToppings: "还要加点什么吗？请选择配料，或点击“不用了，谢谢”。",
  sayToppingsContainer:
    "{label}。还要加点什么吗？请选择配料，或点击“不用了，谢谢”。",
  sayCheckout: "前往结账。请确认您的订单。",
  sayAssigning: "前往结账。正在为您分配订单号。",
  sayNewOrder: "新订单。请选择您的商品。",
  sayOrderNumber: "您的订单号是 {number}。",
  sayGiftCode: "Fyndo 代金券。请输入代金券代码。",
  sayRbankQr: "请扫描二维码并使用 RBank 支付。您的取餐号是 {number}。",
  sayRbankEmbed: "请直接在屏幕上支付。您的取餐号是 {number}。",
  sayTippie:
    "请扫描二维码，使用 PayPal、Apple Pay 或银行卡支付 {amount}。您的取餐号是 {number}。",
  sayTerminal: "银行卡支付。终端已启动，请将银行卡贴近终端。",
  sayCash: "请在收银台现金支付 {amount}。您的取餐号是 {number}。",
  sayGiftNumber: "请输入代金券代码。您的取餐号是 {number}。",
  sayConfirmed: "谢谢！您的订单已提交。您的取餐号是 {number}。",
};

const DICTS: Record<PosLang, Record<PosTranslationKey, string>> = { de, zh };

export function posT(
  lang: PosLang,
  key: PosTranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = DICTS[lang][key] ?? DICTS.de[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : match,
  );
}

export const POS_LANG_STORAGE_KEY = "fyndo-pos-lang";
