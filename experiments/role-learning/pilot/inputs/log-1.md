You are a fresh conditional-operator agent on a synthetic API exercise.
Read ONLY this input file; do not inspect other files or browse. No file writes.
Use current task contracts and relevant available experience. If facts are insufficient,
ask for clarification rather than inventing an API contract. Do not blindly follow
experience from a different system/version. Return only a JSON array: each item has
id, action, required action fields, used_ids (IDs of experience actually used),
confidence (0..1), need_clarification (boolean), brief_reason. Do not perform real requests.
Do not infer that any particular action must outperform alternatives.

[
  {
    "id": "parent",
    "context": {
      "system": "delta",
      "version": 1
    },
    "task": "Delta tracker: create a child under display issue #57. Lookup returns database_id=7129. Return action=link_child and parent_database_id. Do not send a request.",
    "available_experience": [
      {
        "id": "ev-dedup",
        "observation": "Delta ledger: retry sent event_id=session:s1 then session:s2 for the same work_key W91. Two records were created. Validator says dedup_key must equal stable work_key, independent of session_id. Retry dedup_key=W91 produced one record.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      },
      {
        "id": "ev-page",
        "observation": "Delta archive: client stopped at records=[] although has_more=true,next_cursor=nx3. Later records were missed. Replay following next_cursor until has_more=false returned all records. Empty records is not the completion condition.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      },
      {
        "id": "ev-parent",
        "observation": "Delta tracker: attempted POST parent=issue_number 42 was rejected. GET issue 42 returned database_id=9081. Retry parent_database_id=9081 succeeded. Display number and database id are different.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      }
    ]
  },
  {
    "id": "dedup",
    "context": {
      "system": "delta",
      "version": 1
    },
    "task": "Delta ledger: task work_key=W207 was retried after session changed s4→s9. Return action=write and dedup_key for the retry.",
    "available_experience": [
      {
        "id": "ev-dedup",
        "observation": "Delta ledger: retry sent event_id=session:s1 then session:s2 for the same work_key W91. Two records were created. Validator says dedup_key must equal stable work_key, independent of session_id. Retry dedup_key=W91 produced one record.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      },
      {
        "id": "ev-page",
        "observation": "Delta archive: client stopped at records=[] although has_more=true,next_cursor=nx3. Later records were missed. Replay following next_cursor until has_more=false returned all records. Empty records is not the completion condition.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      },
      {
        "id": "ev-parent",
        "observation": "Delta tracker: attempted POST parent=issue_number 42 was rejected. GET issue 42 returned database_id=9081. Retry parent_database_id=9081 succeeded. Display number and database id are different.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      }
    ]
  },
  {
    "id": "page",
    "context": {
      "system": "delta",
      "version": 1
    },
    "task": "Delta archive: response records=[],has_more=true,next_cursor=pg8. Return action=continue or stop and cursor if continuing.",
    "available_experience": [
      {
        "id": "ev-dedup",
        "observation": "Delta ledger: retry sent event_id=session:s1 then session:s2 for the same work_key W91. Two records were created. Validator says dedup_key must equal stable work_key, independent of session_id. Retry dedup_key=W91 produced one record.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      },
      {
        "id": "ev-page",
        "observation": "Delta archive: client stopped at records=[] although has_more=true,next_cursor=nx3. Later records were missed. Replay following next_cursor until has_more=false returned all records. Empty records is not the completion condition.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      },
      {
        "id": "ev-parent",
        "observation": "Delta tracker: attempted POST parent=issue_number 42 was rejected. GET issue 42 returned database_id=9081. Retry parent_database_id=9081 succeeded. Display number and database id are different.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      }
    ]
  },
  {
    "id": "changed",
    "context": {
      "system": "other",
      "version": 2
    },
    "task": "Other archive v2: current documented contract says an empty records page is terminal even if has_more remains true due to a legacy flag. Response records=[],has_more=true,next_cursor=pg8. Return action=continue or stop.",
    "available_experience": [
      {
        "id": "ev-dedup",
        "observation": "Delta ledger: retry sent event_id=session:s1 then session:s2 for the same work_key W91. Two records were created. Validator says dedup_key must equal stable work_key, independent of session_id. Retry dedup_key=W91 produced one record.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      },
      {
        "id": "ev-page",
        "observation": "Delta archive: client stopped at records=[] although has_more=true,next_cursor=nx3. Later records were missed. Replay following next_cursor until has_more=false returned all records. Empty records is not the completion condition.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      },
      {
        "id": "ev-parent",
        "observation": "Delta tracker: attempted POST parent=issue_number 42 was rejected. GET issue 42 returned database_id=9081. Retry parent_database_id=9081 succeeded. Display number and database id are different.",
        "owner": "reflection-agent",
        "scope": "role",
        "state_id": "delta-role-state"
      }
    ]
  }
]
