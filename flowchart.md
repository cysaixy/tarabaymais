%% filename: ai_farming_system_flowchart.mmd
flowchart TD
    %% =========================================================
    %% TARABAY-MAIS - END-TO-END SYSTEM FLOW
    %% =========================================================

    START([🌽 Tarabay-Mais Assistant]) --> AUTH{Authenticated?}

    %% ---------------------------------------------------------
    %% AUTHENTICATION / ONBOARDING
    %% ---------------------------------------------------------
    AUTH -->|No| LOGIN[Login via Firebase Auth]
    LOGIN --> CRED{Credentials valid?}
    CRED -->|No| LOGIN_ERR[Show authentication error]
    LOGIN_ERR --> LOGIN
    CRED -->|Yes| SESSION[Create authenticated session\nBearer Firebase ID Token]

    AUTH -->|Yes| SESSION

    SESSION --> PROFILE_CHECK{Farmer profile exists?}
    PROFILE_CHECK -->|No| PROFILE[Create Farmer Profile\n• RSBSA Number\n• Preferred language]
    PROFILE --> FARM_CHECK
    PROFILE_CHECK -->|Yes| FARM_CHECK{Farm exists?}

    %% ---------------------------------------------------------
    %% FARM & CROP REGISTRATION
    %% ---------------------------------------------------------
    FARM_CHECK -->|No| FARM_SETUP[Register Farm\n• Farm name\n• Municipality & Barangay\n• Area in hectares\n• Lat/Lng coordinates]
    FARM_SETUP --> CROP_CHECK
    FARM_CHECK -->|Yes| DASHBOARD[Farmer Dashboard]

    CROP_CHECK{Active crop cycle exists?}
    CROP_CHECK -->|No| CROP_SETUP[Register Crop Cycle\n• Crop type = Corn\n• Variety\n• Planting date\n• Area planted]
    CROP_SETUP --> TIMELINE
    CROP_CHECK -->|Yes| TIMELINE

    %% ---------------------------------------------------------
    %% CORE DASHBOARD / CROP LIFECYCLE
    %% ---------------------------------------------------------
    TIMELINE[Crop Lifecycle Engine\n• Calculate days after planting\n• Determine growth stage\n• Generate stage-based activities] --> DASHBOARD

    DASHBOARD --> ACTION{What does farmer need?}

    %% ---------------------------------------------------------
    %% CROP MONITORING & ACTIVITIES
    %% ---------------------------------------------------------
    ACTION -->|Monitor crop| MONITOR[View Crop Status\n• Growth stage\n• Recent observations\n• Active crop cycle]
    MONITOR --> ACTION

    ACTION -->|Record activity| ACTIVITY[Record Farm Activity\n• Fertilizer / Irrigation / Harvest\n• Cost amount & Date]
    ACTIVITY --> LOCAL_SAVE1{Online?}

    %% ---------------------------------------------------------
    %% OFFLINE-FIRST FLOW
    %% ---------------------------------------------------------
    LOCAL_SAVE1 -->|Yes| SYNC_ACTIVITY[Save to Backend / PostgreSQL]
    LOCAL_SAVE1 -->|No| LOCAL_QUEUE1[Store locally in IndexedDB\nAssign clientRefId & queue]
    LOCAL_QUEUE1 --> DASHBOARD
    SYNC_ACTIVITY --> DASHBOARD

    ACTION -->|Record observation| OBSERVE[Record Crop Observation\n• Title & Description\n• Photo\n• Severity Level]
    OBSERVE --> LOCAL_SAVE2{Online?}
    LOCAL_SAVE2 -->|Yes| SAVE_OBS[Save Observation to PostgreSQL]
    LOCAL_SAVE2 -->|No| LOCAL_QUEUE2[Queue Observation locally\nAssign clientRefId]
    LOCAL_QUEUE2 --> DASHBOARD
    
    SAVE_OBS --> EVAL_SEVERITY{Severity HIGH or CRITICAL?}
    EVAL_SEVERITY -->|Yes| AUTO_ESCALATE[Auto-Escalate to Expert Request]
    AUTO_ESCALATE --> FCM_TECH_ALERT[FCM Multicast Push Alert\nNotify Municipal Technicians]
    FCM_TECH_ALERT --> EXPERT_CASE[Create Assistance Case]
    EVAL_SEVERITY -->|No| SCAN_DECISION{Analyze Photo with AI?}

    %% ---------------------------------------------------------
    %% PLANT HEALTH SCANNER (GEMINI MULTIMODAL)
    %% ---------------------------------------------------------
    ACTION -->|Check plant health| SCANNER_UI[Plant Health Scanner\nTake / Upload Photo]
    SCANNER_UI --> IMAGE_VALIDATE{Image usable?}
    IMAGE_VALIDATE -->|No| IMAGE_RETRY[Ask for clearer photo\n• Good lighting\n• Visible leaf damage]
    IMAGE_RETRY --> SCANNER_UI
    IMAGE_VALIDATE -->|Yes| ONLINE_SCAN{Online?}

    ONLINE_SCAN -->|No| QUEUE_SCAN[Save scan payload locally\nQueue clientRefId for sync]
    QUEUE_SCAN --> DASHBOARD

    ONLINE_SCAN -->|Yes| GEMINI_VISION[Gemini 3.6 Flash Multimodal Vision\n• Direct visual leaf analysis\n• Disease & pest identification\n• Immediate symptom extraction]
    GEMINI_VISION --> SCAN_RESULT[Vision Diagnosis Result\nCondition + Confidence + Severity]

    SCAN_RESULT --> CONTEXT[Build Active Farm Context]
    CONTEXT --> CONTEXT_DATA[Combine:\n• Farmer & Farm location\n• Crop stage & Variety\n• Past observations & activities\n• Gemini Vision diagnosis]

    %% ---------------------------------------------------------
    %% RAG CHATBOT ASSISTANT
    %% ---------------------------------------------------------
    ACTION -->|Ask AI assistant| CHAT[AI Farming Assistant]
    CHAT --> QUERY[Farmer Question]
    QUERY --> CONTEXT_Q[Attach Active Farm Context]
    CONTEXT_Q --> RAG[RAG Pipeline]

    RAG --> RETRIEVE[Vector Search pgvector\nRetrieve DA Region II / RCPC / OPA\nAgricultural Guidelines]
    RETRIEVE --> LLM[Gemini 3.6 Flash Engine]

    SCAN_RESULT --> RAG_SCAN[Retrieve verified treatments for diagnosis]
    RAG_SCAN --> LLM_SCAN[Gemini interprets scan + RAG context]
    CONTEXT_DATA --> LLM_SCAN

    LLM --> RESPONSE[Grounded AI Response]
    LLM_SCAN --> RESPONSE_SCAN[Grounded Health Guidance]

    RESPONSE --> SAFETY1[Safety Guardrails\n• Information grounded in DA guides\n• Non-autonomous diagnosis warning\n• Expert escalation option]
    RESPONSE_SCAN --> SAFETY2[Safety Guardrails\n• Recommended treatment options\n• Safe chemical / bio-pesticide doses\n• Technician review recommendation]

    SAFETY1 --> CHAT_RESULT[Show response + cited sources]
    CHAT_RESULT --> ACTION

    SAFETY2 --> SCAN_RESULT_UI[Show diagnosis + treatment plan]
    SCAN_RESULT_UI --> SAVE_SCAN[Save Scan & AI Diagnosis]
    SAVE_SCAN --> ACTION

    %% ---------------------------------------------------------
    %% EXPERT CASE ESCALATION & RESOLUTION
    %% ---------------------------------------------------------
    ACTION -->|Request expert help| EXPERT_REQ[Request Technician Assistance]
    EXPERT_REQ --> EXPERT_FORM[Submit Case Details]
    EXPERT_FORM --> LOCAL_SAVE3{Online?}
    LOCAL_SAVE3 -->|No| LOCAL_QUEUE3[Queue case request locally]
    LOCAL_QUEUE3 --> DASHBOARD
    LOCAL_SAVE3 -->|Yes| EXPERT_CASE
    
    EXPERT_CASE --> TECHNICIAN[Assigned Municipal Agriculture Technician]
    TECHNICIAN --> REVIEW[Review farm context + observation + photo]
    REVIEW --> EXPERT_RESPONSE[Submit Treatment Recommendation]
    EXPERT_RESPONSE --> FCM_FARMER_ALERT[FCM Push Alert to Farmer\n'Crop Recommendation Updated']
    FCM_FARMER_ALERT --> FARMER_NOTIFY[Update Case Status to RESOLVED]
    FARMER_NOTIFY --> ACTION

    %% ---------------------------------------------------------
    %% DISASTER / DAMAGE REPORTING
    %% ---------------------------------------------------------
    ACTION -->|Report disaster damage| DAMAGE[Disaster Damage Report]
    DAMAGE --> DAMAGE_FORM[Enter details:\n• Disaster type: typhoon/flood/drought\n• Damage percentage & estimated loss\n• Farm ID & Notes]
    DAMAGE_FORM --> DAMAGE_ONLINE{Online?}
    DAMAGE_ONLINE -->|No| DAMAGE_QUEUE[Queue disaster report locally]
    DAMAGE_QUEUE --> DASHBOARD
    DAMAGE_ONLINE -->|Yes| DAMAGE_SAVE[Save Disaster Report to PostgreSQL]
    DAMAGE_SAVE --> DAMAGE_STATUS[Status: SUBMITTED → UNDER_REVIEW → RESOLVED]
    DAMAGE_STATUS --> GOV_DASH

    %% ---------------------------------------------------------
    %% GOVERNMENT & MUNICIPAL OFFICER DASHBOARD
    %% ---------------------------------------------------------
    GOV_ENTRY([Authorized Officer / Technician]) --> GOV_LOGIN[Officer Login]
    GOV_LOGIN --> GOV_AUTH{Authorized Role?}
    GOV_AUTH -->|No| GOV_DENY[Access Denied]
    GOV_DENY --> GOV_LOGIN
    GOV_AUTH -->|Yes| GOV_DASH[Municipal Agriculture Dashboard]

    GOV_DASH --> GOV_OVERVIEW[Municipal Overview\n• Registered farms & crop cycles\n• Active pest observations\n• Pending disaster claims]
    GOV_DASH --> GOV_CASES[Case Management\n• Review high/critical alerts\n• Resolve farmer requests]
    GOV_DASH --> GOV_EXPORTS[Municipal Export Utility\nexceljs CSV / XLSX Exporters]

    GOV_EXPORTS --> EXPORT_DOWNLOAD[GET /api/v1/analytics/export\nDownload Disaster Claims & Barangay Summaries]
    GOV_CASES --> GOV_REVIEW[Officer updates case status]
    GOV_REVIEW --> EXPERT_RESPONSE

    %% ---------------------------------------------------------
    %% OFFLINE BATCH SYNC ENGINE
    %% ---------------------------------------------------------
    APP_OFFLINE[Device Reconnects to Internet] --> SYNC_ENGINE[Background Sync Engine]
    SYNC_ENGINE --> SYNC_API[POST /api/v1/sync\nBatch Sync Endpoint]
    SYNC_API --> BATCH_PROC[Process Batch Actions\n• Match clientRefId to server ID\n• Execute Prisma Writes\n• Handle Orphaned Entities]
    BATCH_PROC --> DB[(PostgreSQL Database)]
    BATCH_PROC --> SYNC_EVAL{Contains HIGH/CRITICAL Observation?}
    SYNC_EVAL -->|Yes| FCM_TECH_ALERT
    SYNC_EVAL -->|No| DASHBOARD

    %% ---------------------------------------------------------
    %% CORE DATA & VECTOR PIPELINE
    %% ---------------------------------------------------------
    DB[(PostgreSQL Database)]
    DB --> FARM_DATA[Farm Models\nUser → Farm → CropCycle → Activity]
    DB --> HISTORY[Observations & Scans]
    DB --> CASE_DATA[Expert Requests & Disaster Reports]

    FARM_DATA --> CONTEXT
    HISTORY --> CONTEXT

    SOURCES[DA Region II / Official Guides] --> INGEST[Document Ingestion Pipeline]
    INGEST --> CHUNK[Text Chunking]
    CHUNK --> EMBED[text-embedding-004\nGenerate 768-dim Embeddings]
    EMBED --> VECTOR[(PostgreSQL pgvector)]
    VECTOR --> RAG
    VECTOR --> RAG_SCAN

    %% ---------------------------------------------------------
    %% TERMINAL USER FLOWS
    %% ---------------------------------------------------------
    ACTION -->|View history| HISTORY_UI[Farm History\n• Activities & Observations\n• AI Scans & Expert Recommendations]
    HISTORY_UI --> ACTION

    ACTION -->|Manage profile| SETTINGS[Profile / FCM Device Token Sync]
    SETTINGS --> DASHBOARD

    %% ---------------------------------------------------------
    %% STYLING
    %% ---------------------------------------------------------
    classDef user fill:#eef6ff,stroke:#2563eb,stroke-width:2px;
    classDef ai fill:#f5f0ff,stroke:#7c3aed,stroke-width:2px;
    classDef data fill:#effdf5,stroke:#16a34a,stroke-width:2px;
    classDef gov fill:#fff7ed,stroke:#ea580c,stroke-width:2px;
    classDef offline fill:#f8fafc,stroke:#64748b,stroke-width:2px;
    classDef warning fill:#fff1f2,stroke:#e11d48,stroke-width:2px;

    class START,LOGIN,PROFILE,FARM_SETUP,CROP_SETUP,DASHBOARD,MONITOR,ACTIVITY,OBSERVE,SCANNER_UI,CHAT,HISTORY_UI,SETTINGS user;
    class GEMINI_VISION,RAG,RAG_SCAN,LLM,LLM_SCAN,CONTEXT,CONTEXT_Q,RETRIEVE,RESPONSE,RESPONSE_SCAN,SAFETY1,SAFETY2 ai;
    class DB,VECTOR,FARM_DATA,HISTORY,CASE_DATA,SOURCES,INGEST,CHUNK,EMBED data;
    class GOV_ENTRY,GOV_LOGIN,GOV_DASH,GOV_OVERVIEW,GOV_CASES,GOV_EXPORTS,EXPORT_DOWNLOAD,GOV_REVIEW,TECHNICIAN gov;
    class APP_OFFLINE,LOCAL_QUEUE1,LOCAL_QUEUE2,LOCAL_QUEUE3,QUEUE_SCAN,DAMAGE_QUEUE,SYNC_ENGINE,SYNC_API,BATCH_PROC offline;
    class CRED,IMAGE_VALIDATE,ONLINE_SCAN,LOCAL_SAVE1,LOCAL_SAVE2,LOCAL_SAVE3,DAMAGE_ONLINE,GOV_AUTH,PROFILE_CHECK,FARM_CHECK,CROP_CHECK,EVAL_SEVERITY,SYNC_EVAL warning;