# Task state to motion

Mascot presentation is derived from persisted task/step/event data by `deriveNookBrainState`. The model cannot choose animation states or coordinates.

| Backend evidence                        | Brain state             |
| --------------------------------------- | ----------------------- |
| planning / policy review                | planning or remembering |
| needs clarification                     | asking                  |
| awaiting approval                       | waiting                 |
| running `search_web`                    | researching             |
| running another registered tool         | working                 |
| verifying                               | checking                |
| completed with verification evidence    | presenting              |
| completed without verification evidence | checking                |
| blocked                                 | warning                 |
| failed                                  | error                   |
| offline                                 | sleeping                |

Celebration is not derived directly from completion. It requires a later, bounded presentation transition after verified completion. No random delay represents cognition.
