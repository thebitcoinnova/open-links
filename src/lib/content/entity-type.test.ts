import assert from "node:assert/strict";
import test from "node:test";
import {
  isPersonEntityType,
  resolveEntityAnalyticsLabel,
  resolveEntityPageLabel,
  resolveEntityPageNoun,
  resolveEntityType,
} from "./entity-type";

test("resolveEntityType defaults missing values to person", () => {
  // Arrange
  const missingValue = undefined;

  // Act
  const resolved = resolveEntityType(missingValue);

  // Assert
  assert.equal(resolved, "person");
});

test("resolveEntityType accepts organization as an explicit entity type", () => {
  // Arrange
  const explicitValue = "organization";

  // Act
  const resolved = resolveEntityType(explicitValue);

  // Assert
  assert.equal(resolved, "organization");
});

test("entity labels stay person-oriented by default and page-oriented for organizations", () => {
  // Arrange
  const defaultLabel = resolveEntityPageLabel();
  const organizationLabel = resolveEntityPageLabel("organization");
  const organizationNoun = resolveEntityPageNoun("organization");
  const organizationAnalyticsLabel = resolveEntityAnalyticsLabel("organization");

  // Assert
  assert.equal(defaultLabel, "Profile");
  assert.equal(organizationLabel, "Page");
  assert.equal(organizationNoun, "page");
  assert.equal(organizationAnalyticsLabel, "Audience Analytics");
  assert.equal(isPersonEntityType("organization"), false);
});
