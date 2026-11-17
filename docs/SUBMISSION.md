# Devpost submission: Fold

Paste-ready text for the Reddit Game of the Day hackathon form.

## Project name

Fold

## Elevator pitch (≤ 200 characters)

A daily folding puzzle: fold a sheet of coloured tiles until it matches the picture, in as few folds as you can. Every fold flips the paper over. Then make your own Fold for the community.

## Required links

- **App listing:** https://developers.reddit.com/apps/fold-daily
- **Demo post:** https://www.reddit.com/r/FoldDaily/comments/1xyjhsr/fold_1_tue_nov_17_easy_par_2/
- **Community:** https://www.reddit.com/r/FoldDaily/
- **Source code:** https://github.com/bars26/fold-daily

## Built with

devvit, devvit-web, typescript, react, tailwindcss, vite, hono, redis, web-audio-api

## About the project

### Inspiration

Paper folding is a puzzle everyone already understands with their hands: fold a corner and you see the back of the paper. We wanted a daily game where that single physical rule is the whole game, with no word list and no trivia, only spatial reasoning that is easy to start and hard to master.

### What it does

Each day r/FoldDaily gets a new post with a sheet of coloured tiles and a target picture. You tap a crease, pick which side to fold over, and the flap turns over in 3D and lands kraft-side up. Match the picture in as few folds as you can; par is always the true minimum.

- **Previews on every crease.** Each side of a selected crease shows what the sheet will look like after that fold, with a ✓ when it matches the picture. This turns a hard mental-rotation task into reading and planning.
- **Hints and Undo.** 💡 Hint finds the next fold on an optimal path from wherever you are. If there is no longer enough paper left to make the picture, the game says so.
- **A guided first fold.** New players learn the one rule by doing it once, not by reading.
- **A daily rhythm.** Difficulty climbs through the week (Monday 4×4 with two folds, Sunday 6×6 with four). Streaks show as user flair ("🔥 5-day Fold streak").
- **Community, not just a scoreboard.** Spoiler-free "Comment my result", a fold-count histogram and leaderboard on every post, and **Make your own Fold**: paint a sheet, fold it 2–4 times and post it as a puzzle. The server proves it is solvable and computes its real par.
- **Always something to play.** A 30-day archive, a list of recent community puzzles and unranked practice puzzles at three levels.

### How we built it

Fold runs on Devvit Web: a React + Tailwind client in the post, and a Hono server using Devvit Redis, the scheduler, user actions and Journeys.

The paper is modelled as stacks of layers; a fold reverses and flips the moving stacks onto their mirror positions. That shared engine powers the client, the server-side solve check and a breadth-first solver. Daily puzzles come from a seeded generator that keeps only puzzles where the solver proves par equals the intended number of folds, and that pass quality filters (big enough, not mostly bare kraft, at least two colours showing). The same solver drives hints, dead-end detection and the validation of community puzzles.

### Challenges we ran into

Our first playtest was humbling: the puzzle worked, but people could not picture the result of a fold in their heads, and folded the sheet into a single tile. We added fold previews, a hint that works from any position, a dead-end warning, a gentler weekly curve and an interactive first fold. Generating puzzles that are fair and look like pictures, not noise, also took several iterations of filters.

### Accomplishments that we're proud of

Every par is proven optimal, every result is verified on the server, and every community puzzle is checked before it is posted. The 3D fold animation, synthesised paper sounds and the creator make the game feel like paper, not a grid.

### What we learned

Clarity beats cleverness: the biggest improvement in fun came from showing players the consequence of a move before they make it.

### What's next for Fold

Weekly themed community challenges, larger sheets and non-rectangular paper for weekend puzzles, and push notifications to protect streaks.
