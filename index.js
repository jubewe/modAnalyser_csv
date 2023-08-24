const fs = require("fs");
const { mainPath, ascii, regex, chunkArray } = require("oberknecht-utils");
const { request } = require("oberknecht-request");
const path = require("path");
const { parse } = require("csv-parse");
let config = {
  input: {
    folderpath: mainPath("./input"),
    filepath: undefined,
    twitchnamekey: mainPath("./input/twitchnamekey.txt"),
  },
  output: {
    filetxtkeys: mainPath("./output/output-keys.txt"),
    filetxtentries: mainPath("./output/output-entries.txt"),
    filejsonparsed: mainPath("./output/output-parsed.json"),
    filejson: mainPath("./output/output.json"),
  },
};

const csvreg = () => {
  return /\w+\.csv$/;
};
const quotereg = () => {
  return /^"|"$/;
};
const csvpath = fs
  .readdirSync(config.input.folderpath, { withFileTypes: true })
  .filter((a) => a.isFile() && csvreg().test(a.name))[0]?.name;
if (!csvpath)
  return console.error(
    Error(
      `csvpath is undefined - No file matching regex ${
        csvreg().source
      } found in folder ${config.input.folderpath}`
    )
  );
config.input.filepath = path.resolve(config.input.folderpath, csvpath);
const twitchnamekey = fs
  .readFileSync(config.input.twitchnamekey, "utf-8")
  .split("\n")[1];

const csvLinesRaw = [];
fs.createReadStream(config.input.filepath)
  .pipe(parse({ delimiter: ",", from_line: 1 }))
  .on("data", (line) => {
    csvLinesRaw.push(line);
  })
  .on("finish", async () => {
    const keys = csvLinesRaw[0].map((a) => [
      a.replace(quotereg(), ""),
      ascii.toNumbers(a.replace(quotereg(), "")),
    ]);
    const entries = csvLinesRaw.slice(1).map((a) => {
      let b = a.slice(0, keys.length - 1);
      b[b.length - 1] = b.slice(b.length - 1).join("\\n");
      return b.map((c) => c.trim().replace(/\n/g, "\\n"));
    });
    let csvjson = { keys: keys, entries: entries };
    fs.writeFileSync(config.output.filetxtkeys, keys.join("\n"));
    fs.writeFileSync(config.output.filetxtentries, entries.join("\n"));
    fs.writeFileSync(config.output.filejsonparsed, JSON.stringify(csvjson));

    if (!twitchnamekey)
      throw Error(
        "Twitchnamekey is undefined - key in ./input/twitchnamekey not found"
      );
    let nameKeyIndex = csvjson.keys
      .map((a, i) => [i, a])
      .filter((a) => a[1].includes(twitchnamekey))[0]?.[0];
    if (!nameKeyIndex)
      throw Error(
        "nameKeyIndex is undefined - key specified in twitchNameKey does not match any of the headerkeys in csv"
      );

    let twitchNames = csvjson.entries.map((a) => a[nameKeyIndex]);
    console.log(twitchNames);

    let invalidTwitchNames = twitchNames.filter(
      (a) => !regex.twitch.usernamereg().test(a)
    );
    twitchNames = twitchNames.filter((a) => regex.twitch.usernamereg().test(a));

    let json = { keys: csvjson.keys, entries: [], errors: [] };

    await Promise.all(
      chunkArray(twitchNames, 10).map(async (a) => {
        return await request(
          `https://modlookup.jubewe.de/api/v1/modlookup/user/${a.join(";")}`
        ).then((u) => {
          let dat = JSON.parse(u.body).data;
          Object.keys(dat).forEach((a) => {
            if (dat[a].error) json.errors.push(dat[a]);
            json.entries.push({
              ...dat[a],
              answers: csvjson.entries.filter(
                (a) => a[nameKeyIndex].toLowerCase() === dat[a].login
              )[0],
            });
          });
        });
      })
    );

    fs.writeFileSync(config.output.filejson, JSON.stringify(json));
  });
