# Gemini API Integration - Documentation Index

## Quick Navigation

### For Quick Answers
- **Start here:** [GEMINI_API_QUICK_REFERENCE.md](./GEMINI_API_QUICK_REFERENCE.md)
- **Time:** 5-10 minutes
- **Content:** TL;DR facts, code locations, common errors, testing commands

### For Complete Understanding
- **Comprehensive guide:** [GEMINI_API_EXPLORATION_REPORT.md](./GEMINI_API_EXPLORATION_REPORT.md)
- **Time:** 20-30 minutes
- **Content:** Detailed technical breakdown, architecture, all code references

### For Migration Planning
- **Migration summary:** [GEMINI_API_MIGRATION_SUMMARY.md](./GEMINI_API_MIGRATION_SUMMARY.md)
- **Time:** 10-15 minutes
- **Content:** Before/after comparison, benefits, setup instructions

### For Testing
- **Test script:** [test-real-mode.sh](./test-real-mode.sh)
- **Test guide:** [REAL_MODE_TEST.md](./REAL_MODE_TEST.md)
- **Quick commands:** [REAL_MODE_QUICK_COMMANDS.md](./REAL_MODE_QUICK_COMMANDS.md)

---

## Documentation Structure

### Section 1: API Key Storage & Configuration
**Find in:** GEMINI_API_EXPLORATION_REPORT.md Section 1
**Quick Ref:** GEMINI_API_QUICK_REFERENCE.md → "Secrets Manager Configuration"

- AWS Secrets Manager integration
- Environment variables
- Secret retrieval function
- IAM permissions

**Files to check:**
- `/lambdas/worker/index.js` (lines 25, 37-63)
- `/template.yaml` (lines 379-386)

---

### Section 2: API Calls for Image Generation
**Find in:** GEMINI_API_EXPLORATION_REPORT.md Section 2
**Quick Ref:** GEMINI_API_QUICK_REFERENCE.md → "Code Locations"

- Main function: `generateRealImage()`
- API endpoint and authentication
- Request payload structure
- Response handling
- Error management

**Files to check:**
- `/lambdas/worker/index.js` (lines 218-291)

---

### Section 3: Request & Response Structure
**Find in:** GEMINI_API_EXPLORATION_REPORT.md Section 3
**Quick Ref:** GEMINI_API_QUICK_REFERENCE.md → "API Request/Response Structure"

- Full request example
- Full response example
- Response validation checklist
- Image processing pipeline

**Key details:**
- Request format with all required fields
- Response base64 handling
- Sharp image processing
- DynamoDB metadata storage

---

### Section 4: Configuration Files
**Find in:** GEMINI_API_EXPLORATION_REPORT.md Section 4
**Quick Ref:** GEMINI_API_QUICK_REFERENCE.md → "CloudFormation Configuration"

- CloudFormation template (template.yaml)
- Package dependencies
- Environment variables
- Test configuration

**Files to check:**
- `/template.yaml` (multiple sections)
- `/lambdas/worker/package.json`
- `/lambdas/worker/tests/`

---

### Section 5: Cost Tracking
**Find in:** GEMINI_API_EXPLORATION_REPORT.md Section 6
**Quick Ref:** GEMINI_API_QUICK_REFERENCE.md → "Cost Tracking"

- Pricing model ($0.04 per image)
- Cost storage in DynamoDB
- Job-level aggregation

---

### Section 6: Mock Mode
**Find in:** GEMINI_API_EXPLORATION_REPORT.md Section 5
**Quick Ref:** GEMINI_API_QUICK_REFERENCE.md → "Testing"

- Zero-cost testing without API calls
- SVG-based placeholder generation
- Mock vs real flow

**Files to check:**
- `/lambdas/worker/utils/mockGenerator.js`

---

### Section 7: Error Handling
**Find in:** GEMINI_API_EXPLORATION_REPORT.md Section 8
**Quick Ref:** GEMINI_API_QUICK_REFERENCE.md → "Error Handling"

- Common errors and solutions
- Error logging
- Response validation
- Image validation with Rekognition

---

### Section 8: Architecture Overview
**Find in:** GEMINI_API_EXPLORATION_REPORT.md Section 7
**Quick Ref:** GEMINI_API_QUICK_REFERENCE.md → "Request Flow Diagram"

- Worker Lambda handler
- Message structure from SQS
- DynamoDB schema
- S3 storage structure

---

## File Locations by Purpose

### Core Implementation
```
lambdas/worker/index.js
├── initializeGemini() - lines 37-63
├── processImage() - lines 99-212
├── generateRealImage() - lines 218-291
├── processImageBuffer() - lines 298-335
├── validateImage() - lines 340-417
├── uploadToS3() - lines 422-449
└── DynamoDB functions - lines 454-616
```

### Configuration & Deployment
```
template.yaml
├── Parameters - lines 10-26
├── Secrets Manager - lines 205-220
├── IAM Policies - lines 379-386
├── Worker Role - lines 341-413
└── Outputs - lines 455-516

lambdas/worker/package.json
└── Dependencies (aws-sdk, axios, sharp, uuid)

lambdas/worker/package-lock.json
└── Locked dependency versions
```

### Testing
```
test-real-mode.sh
├── Secret verification - lines 52-59
├── Mode switching - lines 74-90
├── Job creation - lines 92-113
├── Progress monitoring - lines 122-147
└── Results verification - lines 149-172

lambdas/worker/tests/unit/worker-final.test.js
├── Mock mode tests
├── Real mode tests (with mocked Gemini)
└── Validation tests

lambdas/worker/utils/mockGenerator.js
├── generateImage() method
├── createSVG() method
└── SVG template generation
```

### Documentation
```
GEMINI_API_EXPLORATION_REPORT.md (PRIMARY - 589 lines)
├── 1. API Key Storage & Configuration
├── 2. Gemini API Calls
├── 3. Request & Response Structure
├── 4. Configuration Files
├── 5. Mock Mode
├── 6. Cost Tracking
├── 7. Architecture
├── 8. Error Handling & Validation
├── 9. Current State Summary
└── 10. File Manifest

GEMINI_API_QUICK_REFERENCE.md (QUICK - 320 lines)
├── TL;DR facts table
├── Code locations
├── API structure
├── Secrets management
├── Request flow
├── Error handling
├── Cost tracking
├── Testing commands
├── Dependencies
└── Migration notes

GEMINI_API_MIGRATION_SUMMARY.md (EXISTING - 216 lines)
├── Migration overview
├── Key changes
├── API comparison
├── Cost analysis
├── Test updates
└── Production deployment

(This document) GEMINI_API_INDEX.md
└── Navigation and cross-references
```

---

## Common Tasks & Where to Find Help

### Task: Understand the Full API Integration
1. Read: GEMINI_API_QUICK_REFERENCE.md → "TL;DR - Key Facts"
2. Review: /lambdas/worker/index.js → generateRealImage() function
3. Study: GEMINI_API_EXPLORATION_REPORT.md → Sections 2-3

### Task: Debug an API Error
1. Check: GEMINI_API_QUICK_REFERENCE.md → "Error Handling"
2. Review: /lambdas/worker/index.js → lines 286-291
3. View logs: `aws logs tail /aws/lambda/rda-worker-dev`

### Task: Check Request/Response Format
1. See: GEMINI_API_QUICK_REFERENCE.md → "API Request/Response Structure"
2. Full details: GEMINI_API_EXPLORATION_REPORT.md → Section 3
3. Code: /lambdas/worker/index.js → lines 244-280

### Task: Set Up Gemini API Key
1. Quick steps: GEMINI_API_QUICK_REFERENCE.md → "Secrets Manager Configuration"
2. Full guide: GEMINI_API_EXPLORATION_REPORT.md → Section 1
3. Test: `aws secretsmanager get-secret-value --secret-id "rda-generator/gemini-api-key-dev"`

### Task: Run Real Mode Test
1. Steps: GEMINI_API_QUICK_REFERENCE.md → "Testing"
2. Full guide: REAL_MODE_TEST.md
3. Quick commands: REAL_MODE_QUICK_COMMANDS.md
4. Script: ./test-real-mode.sh

### Task: Understand Cost Tracking
1. Overview: GEMINI_API_QUICK_REFERENCE.md → "Cost Tracking"
2. Details: GEMINI_API_EXPLORATION_REPORT.md → Section 6
3. Code: /lambdas/worker/index.js → lines 136, 500

### Task: Migrate to Replicate API
1. Checklist: GEMINI_API_QUICK_REFERENCE.md → "Files to Update for Replicate Migration"
2. Priority 1 files to change
3. Pattern to follow: Current generateRealImage() function

---

## Key Metrics & Facts

| Metric | Value |
|--------|-------|
| **Lines of Code (Main)** | 616 (worker/index.js) |
| **Lines of Code (Mock)** | 181 (mockGenerator.js) |
| **Test Coverage** | 80%+ |
| **API Response Format** | base64 JSON (b64_json) |
| **Supported Aspect Ratios** | 2 (1.91:1, 1:1) |
| **Cost per Image** | $0.04 (Gemini) |
| **API Timeout** | 120 seconds |
| **Image Output Quality** | 85 (JPEG) |
| **Mock Mode Cost** | $0.00 |
| **Mock Processing Time** | 500-1000ms |

---

## Code References by Line

### generateRealImage() Sections
- **Initialization:** lines 218-225
- **Prompt Enhancement:** lines 226-234
- **Logging:** lines 236-241
- **Payload Creation:** lines 244-249
- **API Call:** lines 252-261
- **Response Processing:** lines 263-280
- **Error Handling:** lines 286-291

### Helper Functions
- **initializeGemini():** lines 37-63
- **processImageBuffer():** lines 298-335
- **validateImage():** lines 340-417
- **uploadToS3():** lines 422-449
- **DynamoDB Updates:** lines 454-616

---

## Integration Points

### AWS Services
- **Secrets Manager:** API key storage & retrieval
- **S3:** Image storage
- **DynamoDB:** Metadata and job tracking
- **Lambda:** Function execution
- **SQS:** Message queue
- **Rekognition:** Image validation
- **CloudWatch:** Logging

### External Services
- **Gemini API:** Image generation
  - Endpoint: generativelanguage.googleapis.com
  - Model: imagen-3.0-generate-002
  - Auth: Bearer token

---

## Version Information

| Component | Version |
|-----------|---------|
| Node.js Runtime | 20.x |
| aws-sdk | ^2.1497.0 |
| axios | ^1.6.0 |
| sharp | ^0.33.0 |
| uuid | ^9.0.1 |
| Jest (testing) | ^29.7.0 |

---

## Last Updated
- **Date:** 2024-11-10
- **Status:** Complete, tested, and ready for Replicate migration
- **Documentation Level:** Comprehensive

---

## Next Steps for Replicate Migration

**Phase 1: Planning**
- Read: GEMINI_API_QUICK_REFERENCE.md → "Important Notes for Replicate Migration"
- Review: Priority 1 files list
- Understand: Replicate API format

**Phase 2: Implementation**
- Update: generateRealImage() function
- Modify: Request/response handling
- Update: Secrets Manager configuration
- Change: Cost per image value

**Phase 3: Testing**
- Test: Mock mode (should be unchanged)
- Test: Real mode with Replicate API
- Verify: Response format handling
- Validate: Image storage and metadata

**Phase 4: Documentation**
- Update: GEMINI_API_MIGRATION_SUMMARY.md
- Update: Test scripts and commands
- Update: Configuration examples

---

For detailed information on any topic, refer to the specific documentation files listed above.
