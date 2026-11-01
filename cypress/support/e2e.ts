/// <reference types="cypress" />

import { addClerkCommands } from "@clerk/testing/cypress";

// Use Clerk's supported commands instead of automating Clerk's own UI.
addClerkCommands({ Cypress, cy });

export {};
