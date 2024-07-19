/**
 * https://docs.skypack.dev/skypack-cdn/code/javascript#using-skypack-urls-in-typescript
 * 
 * **/
declare module 'https://cdn.skypack.dev/*';

declare module 'https://cdn.skypack.dev/@mozilla/readability' {
    export * from '@mozilla/readability';
}
