/**
 * Maintenance Integration Service
 * Integrates OE findings with Maintenance WR (Work Request) system
 */

const axios = require('axios').default;

class MaintenanceIntegrationService {
    constructor() {
        this.baseUrl = process.env.MAINTENANCE_API_URL || 'https://mtuat.gmrlapps.com:3001';
        this.apiKey = process.env.MAINTENANCE_API_KEY;
    }

    /**
     * Get common headers for API requests
     */
    _getHeaders() {
        return {
            'X-API-Key': this.apiKey,
            'X-Source-App': 'OE_INSPECTION',
            'Content-Type': 'application/json'
        };
    }

    /**
     * Get available locations from Maintenance system
     * @returns {Promise<{success: boolean, data: Array<{code: string, name: string}>}>}
     */
    async getLocations() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/external/locations`, {
                headers: this._getHeaders(),
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error('MaintenanceIntegrationService.getLocations error:', error.message);
            return { 
                success: false, 
                message: error.response?.data?.message || error.message,
                data: [] 
            };
        }
    }

    /**
     * Get recent work requests for a location
     * @param {string} locationCode - Store/Location code
     * @param {number} days - Number of days to look back (default 30)
     * @returns {Promise<{success: boolean, data: Array}>}
     */
    async getRecentWorkRequests(locationCode, days = 30) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/external/recent-wrs`, {
                headers: this._getHeaders(),
                params: { storeCode: locationCode, days },
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error('MaintenanceIntegrationService.getRecentWorkRequests error:', error.message);
            return { 
                success: false, 
                message: error.response?.data?.message || error.message,
                data: [] 
            };
        }
    }

    /**
     * Create a new Work Request in the Maintenance system
     * @param {Object} data - WR data
     * @param {string} data.locationCode - Store/Location code
     * @param {string} data.priority - Priority (High, Medium, Low)
     * @param {string} data.title - WR title
     * @param {string} data.description - WR description
     * @param {string} data.requestedBy - Name of requester
     * @param {string} data.requestedByEmail - Email of requester
     * @param {string} data.sourceApp - Source application (OE)
     * @param {string} data.sourceType - Source type (Finding)
     * @param {number} data.sourceId - Source record ID (responseId)
     * @param {string} data.sourceRef - Source reference (documentNumber)
     * @returns {Promise<{success: boolean, data: {wrNumber: string}}>}
     */
    async createWorkRequest(data) {
        try {
            // Map field names to match Maintenance API expectations
            const mappedData = {
                storeCode: data.locationCode,
                storeName: data.storeName,
                sourceItemId: data.sourceId,
                sourceItemType: 'RESPONSE',
                documentNumber: data.sourceRef,
                sectionName: data.sectionName || data.title,
                finding: data.description,
                suggestedAction: data.suggestedAction,
                priority: data.priority || 'Medium',
                referenceValue: data.referenceValue
            };
            
            const response = await axios.post(`${this.baseUrl}/api/external/create-wr`, mappedData, {
                headers: this._getHeaders(),
                timeout: 15000
            });
            return response.data;
        } catch (error) {
            console.error('MaintenanceIntegrationService.createWorkRequest error:', error.message);
            return { 
                success: false, 
                message: error.response?.data?.message || error.message 
            };
        }
    }

    /**
     * Link an existing Work Request to an OE finding
     * @param {string} wrNumber - WR number to link
     * @param {Object} data - Link data
     * @param {string} data.sourceApp - Source application (OE)
     * @param {string} data.sourceType - Source type (Finding)
     * @param {number} data.sourceId - Source record ID (responseId)
     * @param {string} data.sourceRef - Source reference (documentNumber)
     * @returns {Promise<{success: boolean}>}
     */
    async linkToWorkRequest(wrNumber, data) {
        try {
            // Map field names to match Maintenance API expectations
            const mappedData = {
                wrNumber,
                storeCode: data.storeCode || data.locationCode,
                sourceItemId: data.sourceId,
                sourceItemType: 'RESPONSE',
                documentNumber: data.sourceRef,
                sectionName: data.sectionName,
                referenceValue: data.referenceValue,
                finding: data.finding
            };
            
            const response = await axios.post(`${this.baseUrl}/api/external/link-wr`, mappedData, {
                headers: this._getHeaders(),
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error('MaintenanceIntegrationService.linkToWorkRequest error:', error.message);
            return { 
                success: false, 
                message: error.response?.data?.message || error.message 
            };
        }
    }

    /**
     * Get status of a Work Request
     * @param {string} wrNumber - WR number
     * @returns {Promise<{success: boolean, data: Object}>}
     */
    async getWorkRequestStatus(wrNumber) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/external/wr-status/${wrNumber}`, {
                headers: this._getHeaders(),
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error('MaintenanceIntegrationService.getWorkRequestStatus error:', error.message);
            return { 
                success: false, 
                message: error.response?.data?.message || error.message 
            };
        }
    }
}

// Export singleton instance
module.exports = new MaintenanceIntegrationService();
