const { defineConfig } = require("cypress");

module.exports = defineConfig({
  allowCypressEnv: false,

  e2e: {
    // Specs use relative paths (cy.visit('/login')) so the target environment
    // can be swapped without touching test code.
    baseUrl: "https://uatsurveyz.com.au",

    // The app is built with Ionic, whose form controls (<ion-input>,
    // <ion-button>) render their native <input>/<button> inside a shadow root.
    // Without this, cy.get()/.find() cannot reach them.
    includeShadowDom: true,

    // The dashboard header only renders the member greeting above the app's
    // "mobile" breakpoint (768px), so pin a desktop viewport for determinism.
    viewportWidth: 1280,
    viewportHeight: 800,

    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
