/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
const sourcemaps = require(`gulp-sourcemaps`);
const tsProject = require(`gulp-typescript`).createProject(`tsconfig.build.json`, {
    typescript: require(`ttypescript`),
});
const gulp = require(`gulp`);
exports.default = () => {
    const compiled_src = tsProject
        .src()
        .pipe(sourcemaps.init())
        .pipe(
            require(`gulp-strip-code`)({
                start_comment: `<DEV-ONLY>`,
                end_comment: `</DEV-ONLY>`,
            }),
        )
        .pipe(tsProject());
    return require(`merge-stream`)(
        compiled_src.js
            .pipe(require(`gulp-uglify`)({ keep_fnames: true }))
            .pipe(sourcemaps.write(`.`, { includeContent: false, sourceRoot: `./` }))
            .pipe(gulp.dest(`dist`)),
        compiled_src.dts
            .pipe(sourcemaps.write(`.`, { includeContent: false, sourceRoot: `./` }))
            .pipe(gulp.dest(`dist`)),
    );
};
