/**
 * Vision Service for UI Element Location
 * 
 * Integrates with Modal-hosted UGround vision model for precise
 * UI element detection and coordinate extraction from screenshots.
 */

const { locateElement } = require('./modalService');

module.exports = {
  locateElement
};
