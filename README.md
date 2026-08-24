# Weaponstrike Arena

Weaponstrike Arena is a shooting game concept inspired by Fortnite, set in a New York City-style map with premium visuals. The player moves freely through the environment, shoots enemies, and enjoys gameplay designed for both mobile and desktop platforms.

## Development

Install dependencies and run a local dev server with HMR:

```
npm install
npm run dev
```

Then open http://localhost:5173 (Vite default) in your browser. Edit files to see hot reloads.

### Running in dev mode ###

The 'app' bash script (located in the root of the project) contains a collection of convenience commands to make it easy to work within the project. Change your working directory to the project root before using the script:

    $ cd /path/to/app

Start up the app:

    $ ./app start

Then navigate to https://luke.chazmar.com

To tail app logs, run the following:

    $ ./app logs

To stop the app, run the following:

    $ ./app stop

USE WITH CAUTION! If you want to completely clean your local docker environment (e.g. you made tons of local docker / docker compose changes and need wipe all containers, volumes, networks and start clean) run the following command (This will clean your full docker environment and not just docker assets associated with this project):

    $ ./app destructive_clean