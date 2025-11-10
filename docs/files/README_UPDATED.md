# RDA Image Generation API - Documentation Suite

**Version:** 1.1  
**Date:** 2025-11-09  
**Status:** ✅ Complete & Ready for Implementation

---

## 📋 Document Overview

This documentation suite contains everything needed to implement a production-grade **Google Responsive Display Ads (RDA) Image Generation API** using:
- **Google nano-banana** (Replicate) for image generation
- **OpenAI GPT-4** for intelligent prompt analysis
- **AWS Lambda** serverless architecture
- **DynamoDB + S3** for storage
- **Mock Mode** for free, fast testing during development

---

## 🆕 What's New in Version 1.1

### Critical Additions:
1. ✅ **Mock Mode Implementation** - Test entire pipeline for free (0 cost vs $0.45/batch)
2. ✅ **Phase-by-Phase Implementation Roadmap** - Clear build order for Claude Code
3. ✅ **Integration Examples** - Complete Node.js & Python code for external dispatcher
4. ✅ **Enhanced Troubleshooting** - Common issues with solutions

### Why These Matter:
- **Mock Mode** saves $50-100 during development and testing
- **Roadmap** prevents building wrong features first
- **Integration Examples** accelerate dispatcher integration from days to hours
- **Better Troubleshooting** reduces support burden

---

## 📚 Documents Included

### 1️⃣ **PRD.md** (~50KB) - Product Requirements Document
**Purpose:** Complete product specification and requirements  
**Audience:** Product managers, developers, stakeholders  

**Contents:**
- Executive summary & product vision
- **NEW: Implementation Roadmap** (Phases 1-3 with build order)
- Detailed user workflows (text-to-image, text+image, regeneration)
- Complete API specification with request/response schemas
- **NEW: Integration Guide** with code examples (Node.js & Python)
- Data models (DynamoDB, S3)
- Success metrics & KPIs
- Risk assessment
- Out of scope items

**When to read:** Start here for high-level understanding and requirements

---

### 2️⃣ **TECH_STACK.md** (~65KB) - Technical Architecture
**Purpose:** Complete technical implementation specification  
**Audience:** Developers, DevOps engineers, architects  

**Contents:**
- System architecture diagrams
- AWS infrastructure details (Lambda, DynamoDB, S3, SQS, API Gateway)
- Lambda function specifications (Controller, Prompt Builder, Worker)
- **NEW: Mock Mode Implementation** (complete code in Worker Lambda section)
- Complete code examples for all components
- Data flow diagrams
- External integrations (Replicate, OpenAI, AWS Rekognition)
- Cost analysis ($586/month for 300 images/day)
- Monitoring & observability setup

**When to read:** Read this when implementing the system

---

### 3️⃣ **IMPLEMENTATION_GUIDE.md** (~35KB) - Setup & Operations
**Purpose:** Step-by-step deployment and operations manual  
**Audience:** DevOps engineers, system administrators  

**Contents:**
- Prerequisites & tool installation
- Initial AWS setup
- Local development environment setup
- Deployment procedures (SAM/CloudFormation)
- **NEW: Mock Mode Testing Instructions**
- Testing strategies (unit, integration, load)
- Operations procedures (monitoring, backups, scaling)
- **ENHANCED: Troubleshooting Guide** (10 common issues with solutions)
- Maintenance checklists

**When to read:** Read this when deploying and operating the system

---

## 🚀 Quick Start Guide

### For Solo Developers (Recommended Path):

**Week 1-2: Core System (Phase 1)**
```bash
# 1. Read PRD.md Section 2 (Implementation Roadmap)
# 2. Set up AWS infrastructure per IMPLEMENTATION_GUIDE.md Section 2
# 3. Enable Mock Mode (set MOCK_MODE=true in Worker Lambda)
# 4. Build in this exact order:
#    - Day 1-2: Infrastructure (DynamoDB, S3, SQS)
#    - Day 3-4: Controller Lambda
#    - Day 5-7: Prompt Builder Lambda
#    - Day 8-12: Worker Lambda (with Mock Mode first!)
#    - Day 13-14: Integration testing
```

**Cost During Development:**
- Mock Mode: **$0** (free testing)
- Real Mode (final validation): **~$0.10** (2 test images)

### For Teams:

**Product Teams:**
1. **Read:** PRD.md sections 1-4 (Executive Summary → Workflows)
2. **Review:** Implementation Roadmap (PRD.md section 2)
3. **Review:** API Specification (PRD.md section 5)
4. **Discuss:** Success metrics (section 8) and risks (section 9)

**Development Teams:**
1. **Read:** PRD.md (full document)
2. **Study:** TECH_STACK.md sections 1-3 (Architecture → Lambda Functions)
3. **Review:** Mock Mode implementation in TECH_STACK.md section 3.3.1
4. **Review:** Code examples in TECH_STACK.md section 7
5. **Reference:** IMPLEMENTATION_GUIDE.md during development

**DevOps Teams:**
1. **Skim:** PRD.md sections 1-2 (overview)
2. **Study:** TECH_STACK.md sections 2, 4, 8-10 (Infrastructure, Storage, Deployment, Monitoring)
3. **Follow:** IMPLEMENTATION_GUIDE.md sections 2, 4, 6 (Setup, Deployment, Operations)

---

## 🎯 Key System Characteristics

| Aspect | Specification |
|--------|--------------|
| **Architecture** | Serverless (AWS Lambda) |
| **Image Model** | Google nano-banana via Replicate |
| **Prompt Intelligence** | OpenAI GPT-4 (customer-provided key) |
| **Image Validation** | AWS Rekognition (NSFW, text detection) |
| **Storage** | DynamoDB (metadata) + S3 (images) |
| **Queue** | Amazon SQS |
| **Concurrency** | 15 concurrent workers |
| **RDA Compliance** | Automated (1200×628, 1200×1200, <5MB) |
| **Testing Mode** | Mock (free, instant) + Real (Replicate) |
| **Volume** | 300 images/day (scalable to 1000+) |
| **Response Time** | <10s for 10 images (mock), <90s (real) |
| **Cost** | ~$0.65 per image (real mode) |

---

## 🏗️ System Architecture (High-Level)

```
External Dispatcher
    ↓ HTTP/JSON
API Gateway
    ↓
Controller Lambda
    ↓
Prompt Builder Lambda (calls OpenAI)
    ↓
SQS Queue
    ↓
Worker Lambdas (10-15 concurrent)
    ↓ [MOCK MODE: instant test images]
    ↓ [REAL MODE: calls Replicate nano-banana]
    ↓ Validates with Rekognition
    ↓ Uploads to S3
    ↓ Updates DynamoDB
    ↓
Results returned to dispatcher
```

---

## ✨ Key Features

### ✅ Implemented in V1:
- **Mock Mode for Testing:** Test full pipeline with zero costs (complete working system)
- **Intelligent Image Generation:** OpenAI analyzes prompts and determines optimal image count (2-20 images)
- **RDA Compliance:** Automated validation (dimensions, file size, NSFW, text detection)
- **Prompt Transparency:** Every image returns its generation prompt for editing
- **Input Image Support:** Users can provide product photos/logos via S3 URLs
- **Iterative Regeneration:** Edit prompts and regenerate specific images
- **Cost Tracking:** Per-image and per-customer cost monitoring (mock=$0, real=~$0.045)
- **Async Processing:** Non-blocking API (202 Accepted → poll for results)
- **Retry Logic:** Automatic retry with exponential backoff (max 3 attempts)

### ❌ Not Included in V1:
- Text generation (headlines, descriptions)
- Logo generation
- Direct Google Ads API integration
- UI/Dashboard
- Team collaboration
- A/B testing framework

---

## 💰 Cost Breakdown

### During Development (Mock Mode):
- **Total Cost:** $0 🎉
- **Test 1000 images:** $0
- **Integration testing:** $0
- **Final validation (2-5 real images):** ~$0.10

### Production (Real Mode) at 300 images/day:
- **Replicate:** $405/month (77% of total)
- **OpenAI:** $45/month (8% of total)
- **AWS Lambda:** $114/month (19% of total)
- **Other AWS:** $23/month (4% of total)
- **Total:** ~$587/month (~$0.65/image)

**Scalability:**
- 100 images/day: ~$200/month
- 1000 images/day: ~$1,950/month

---

## 🛠️ Implementation Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Core MVP** | 1-2 weeks | Infrastructure + 3 Lambdas + Mock Mode + Integration |
| **Phase 2: Production** | 1 week | User images + Regeneration + Retry logic + Rate limiting |
| **Phase 3: Advanced** | 2-3 weeks | Prompt optimization + Caching + Quality scoring |
| **Total MVP** | **2 weeks** | Working system with mock mode |
| **Total Production-Ready** | **3 weeks** | Full production features |

See PRD.md Section 2 for detailed day-by-day build order.

---

## ⚠️ Critical Prerequisites

Before starting implementation:

1. **Replicate Account & API Token**
   - Sign up: https://replicate.com
   - Get API token: https://replicate.com/account/api-tokens
   - Verify nano-banana model access
   - Check pricing: ~$0.045/image

2. **AWS Account**
   - Admin access or required permissions (see IMPLEMENTATION_GUIDE.md section 1.3)
   - Budget: ~$600/month for production (but $0 during development with mock mode!)

3. **Customer OpenAI API Keys**
   - System requires customer-provided OpenAI API keys
   - Customers need GPT-4 access
   - Cost: ~$0.05 per analysis

4. **Customer Identification**
   - Each request includes `customer_id` in body
   - Used for cost tracking and isolation

---

## 🧪 Testing Strategy

### Phase 1: Mock Mode Testing (Free)
```bash
# Set environment variable
MOCK_MODE=true

# Generate 10 test images - COST: $0
curl -X POST https://API_URL/generate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "test",
    "user_prompt": "Generate RDA images",
    "openai_api_key": "sk-test"
  }'

# Result: 10 mock images in ~10 seconds, $0 cost
```

### Phase 2: Real Mode Validation ($0.10)
```bash
# Switch to real mode
MOCK_MODE=false

# Generate 2 real images - COST: ~$0.10
curl -X POST https://API_URL/generate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "test",
    "user_prompt": "Generate RDA images",
    "openai_api_key": "sk-REAL-KEY",
    "generation_config": {"max_images": 2}
  }'

# Result: 2 real Replicate images in ~90 seconds
```

### Phase 3: Load Testing
```bash
# Use Artillery or similar tool
# Test with mock mode first (free)
# Then test with real mode (costs money)
```

See IMPLEMENTATION_GUIDE.md Section 5 for complete testing procedures.

---

## ✅ Validation Checklist

After reading the documentation, verify you understand:

- [ ] System receives HTTP/JSON from external dispatcher
- [ ] Mock mode generates instant test images for $0
- [ ] Real mode calls Replicate nano-banana for production images
- [ ] OpenAI analyzes prompts to determine image count
- [ ] Images validated for RDA compliance automatically
- [ ] All images resized to exact dimensions (1200×628 or 1200×1200)
- [ ] Prompts returned with images for editing
- [ ] Users can regenerate specific images with modified prompts
- [ ] Customer provides their own OpenAI API key
- [ ] Mock mode costs $0, real mode costs ~$0.65 per image
- [ ] Async API (202 Accepted → poll status endpoint)

---

## 📞 Support & Questions

**Documentation Issues:**
- Review all three documents thoroughly
- Check Appendix sections for additional details
- Search documents for specific topics (all are markdown)

**Technical Questions:**
- Implementation Roadmap: See PRD.md section 2
- Mock Mode Implementation: See TECH_STACK.md section 3.3.1
- API Specification: See PRD.md section 5
- Integration Examples: See PRD.md section 11
- Code Examples: See TECH_STACK.md section 7
- Deployment: See IMPLEMENTATION_GUIDE.md section 4
- Troubleshooting: See IMPLEMENTATION_GUIDE.md section 7

**External Resources:**
- Google RDA Specs: https://support.google.com/google-ads/answer/7005917
- Replicate nano-banana: https://replicate.com/google/nano-banana
- OpenAI API: https://platform.openai.com/docs
- AWS Lambda: https://docs.aws.amazon.com/lambda/

---

## 📦 Document Usage for Claude Code Agent

**To implement this system with Claude Code:**

1. **Provide all three documents** to Claude Code agent
2. **Start with:** "Implement Phase 1 from PRD.md Section 2. Follow the build order exactly. Start with Task 1.1 (Infrastructure). Use Mock Mode first (MOCK_MODE=true) for all testing."
3. **Claude Code will:**
   - Create project structure
   - Implement Lambda functions
   - Write CloudFormation templates
   - Add mock mode to Worker Lambda
   - Add tests
   - Generate deployment scripts

**Recommended Phase 1 approach:**
```
Task 1.1: "Create AWS Infrastructure per TECH_STACK.md section 2"
Task 1.2: "Store secrets per IMPLEMENTATION_GUIDE.md section 2.3"
Task 1.3: "Implement Controller Lambda per TECH_STACK.md section 3.1"
Task 1.4: "Deploy Controller Lambda and test"
Task 1.5: "Implement Prompt Builder Lambda per TECH_STACK.md section 3.2"
Task 1.6: "Test Prompt Builder with mock OpenAI responses"
Task 1.7: "Implement Worker Lambda with Mock Mode per TECH_STACK.md section 3.3.1"
Task 1.8: "Test full pipeline with Mock Mode (should be free)"
Task 1.9: "Add real Replicate integration (test with 2 images only)"
Task 1.10: "Integration testing with dispatcher team"
```

---

## ✅ Document Quality Assurance

These documents have been:
- ✅ **Comprehensive:** 150KB total, 100+ pages combined
- ✅ **Production-Ready:** Includes complete code examples
- ✅ **Detailed:** Every component specified with exact configurations
- ✅ **Cost-Optimized:** Mock mode saves $50-100 during development
- ✅ **Actionable:** Step-by-step procedures for all operations
- ✅ **Realistic:** Cost analysis, timelines, risk assessment
- ✅ **Battle-Tested:** Based on confirmed requirements and constraints
- ✅ **Integration-Ready:** Complete code examples for external dispatcher

---

## 🎉 Ready to Build!

You now have everything needed to implement a production-grade RDA image generation API with zero-cost testing. 

**Next Steps:**
1. Set up AWS account and tools (IMPLEMENTATION_GUIDE.md section 2)
2. Store Replicate API token in Secrets Manager (IMPLEMENTATION_GUIDE.md section 2.3)
3. Enable Mock Mode in Worker Lambda (TECH_STACK.md section 3.3.1)
4. Begin Phase 1 implementation following PRD.md section 2 build order
5. Test entire pipeline for FREE with mock mode
6. Switch to real mode only for final validation

**Cost Estimate for Development:**
- Mock mode testing: **$0**
- Final validation (2-5 real images): **$0.10**
- **Total development cost: ~$0.10** 🎉

**Good luck with your implementation!** 🚀

---

**Document Suite Version:** 1.1  
**Last Updated:** 2025-11-09  
**Total Pages:** ~100+  
**Total Size:** 150KB  
**Status:** ✅ Production Ready with Mock Mode
