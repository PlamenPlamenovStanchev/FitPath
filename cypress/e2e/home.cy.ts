describe("FitPath home page", () => {
  it("shows the application name", () => {
    cy.visit("/");
    cy.contains("h1", "FitPath").should("be.visible");
  });
});
