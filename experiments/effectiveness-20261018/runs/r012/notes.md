Cause: init ran structural state checks only, so it accepted done issues without acceptance/evidence and did not verify imported evidence against workspace files. Import constraints were absent, while checking hashes during every load would make changed artifacts block list/reopen.

Change: added init-only validation for open/done status, nonempty acceptance and evidence for done, evidence object/path/hash format and current contained regular file/hash, and prohibition on a done issue having an open direct descendant. Validation occurs before atomic state creation. Normal reads deliberately do not revalidate evidence; reopen clears active evidence for recertification.

Validation: tests tool ran the original tracker suite plus test_candidate.py: all 15 passed. Coverage includes invalid done imports, malformed status/hash, done parent/open child rejection without state creation, valid open/done imports, and listing/reopening after artifact mutation.

Limits: evidence is validated at import time and may subsequently change; this is intentional so completed records remain inspectable and reopenable. No external verification performed.