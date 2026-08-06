/**
 * The colour each CV entry is drawn in. Keying by entry id rather than by kind
 * is what lets two spells at the same organisation stay distinguishable on the
 * same row; an entry the CV adds without a colour here simply inherits the
 * period's own default.
 */
export const ENTRY_COLORS: Readonly<Record<string, string>> = {
  carbon_health_senior: "#ac7410",
  carbon_health_staff: "#bba5ed",
  claimfound_cto: "#8b1010",
  cnc_managing_partner: "#ef3e66",
  covariance_pm_eng: "#28344a",
  evb_portfolio_analyst: "#163c8a",
  frb_intern: "#ffb7e3",
  parliament_tutor: "#c055a9",
  spendoso_cto: "#7f110c",
  uf_ga: "#dd3434",
  "uf-ph-d-in-business-administration-finance-and-real-estate": "#b13a45",
  "vcu-bachelor-of-science-in-business-concentration-in-finance": "#a94fc8",
  "vcu-master-of-science-in-business-concentration-in-finance": "#a90026",
  vcu_ga: "#dd3434",
};
