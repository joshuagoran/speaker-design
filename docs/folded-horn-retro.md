# Folded horns: what went wrong

The folded-horn work (#190, #191) took a full day and did not give a design tool the owner could use. This note says
why, and what changes.

## What we planned

- A plan doc and a clickable mock (`docs/folded-horn-plan.md`, `docs/folded-horn-mock.html`).
- Boards in the side section. The passage between them. Drag the corners.
- Steps: data, views, the editor, then Design from goals.

## What went wrong

| #   | Problem                              | What it did                                                                                                                                  |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The model did not fit the goal       | The passage was a recipe: each leg named its boards, the closed end and the mouth wall. Code-made layouts fit it. A person drawing does not. |
| 2   | The mock did not test the model      | It had one fixed layout. Nobody added a board, moved the mouth or moved the drivers to another board.                                        |
| 3   | Automation came before hand editing  | Design from goals came before dragging. The owner met the model through generated designs.                                                   |
| 4   | Symptoms were fixed one at a time    | Dead ends, chokes, gaps, driver spacing, ports in the wrong place: each got a local fix. Nobody asked if the model was wrong.                |
| 5   | The score stood in for "a good horn" | It scored flat level only. It liked dead ends, chokes and magnets in the passage.                                                            |
| 6   | One PR grew too big                  | #190 gained the spiral, offset horns, ports, the score, stuffing and fins. Each test met many new things.                                    |
| 7   | I tested too little as a user        | The browser run and the full sweep came late. I checked drawings after the owner found problems.                                             |
| 8   | Rules from other pages leaked in     | Flared tubes needed a PA sub. "Air behind the cones" did nothing. Stuffing went past 100%.                                                   |

The root cause is 1. Problems 2 and 3 hid it. Problem 4 made it cost a day.

## What changes

| Rule                                                                                                    | For  |
| ------------------------------------------------------------------------------------------------------- | ---- |
| Before code, a working mock of the core task. The owner tests it with real tasks.                       | 1, 2 |
| The plan lists the owner's tasks as acceptance tests. I run each in the browser before every hand-over. | 2, 7 |
| Hand editing first, automation second.                                                                  | 3    |
| Three reported bugs in one area: stop. Check the model. Tell the owner before the next fix.             | 4    |
| Physical checks come before the score. The score never decides what is buildable.                       | 5    |
| One feature per PR.                                                                                     | 6    |
| A rule reused from another page gets checked on the new page.                                           | 8    |

## Next

- The traced model: `docs/traced-horn-plan.md` and its mock, `docs/traced-horn-mock.html`.
- The general fixes from #190 ship on their own.
