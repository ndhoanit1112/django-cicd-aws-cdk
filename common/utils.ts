import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import * as _ from "lodash";

/**
 * 環境変数を設定ファイルから読み込みます
 * @param mode development | production
 * @param envDirPath default: process.cwd()
 * @returns void
 */
export const loadEnvironmentVariablesFile = (
  mode: "dev" | "prod",
  envDirPath: string = path.join(process.cwd(), "env")
) => {
  return _.merge(
    yaml.parse(fs.readFileSync(path.join(envDirPath, "base.yml"), "utf-8")),
    yaml.parse(
      fs.readFileSync(
        path.join(
          envDirPath,
          mode === "prod" ? "prod.yml" : "dev.yml"
        ),
        "utf-8"
      )
    )
  );
};