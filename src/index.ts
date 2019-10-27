//import * as express from 'express';
import {CLIENT_ID} from './config';
import { defaults } from "request-promise";

const client = defaults({json: true});

const activeStreams: Map<number, Stream> = new Map();
const alreadySeenTitles: Set<string> = new Set();
const tagCache: Map<string, string> = new Map();

setInterval(update, 60000);

update();

async function update() {
    await updateWithSearch("bingo");
    await updateWithSearch("blackout");
    await updateWithSearch("beta quest");
}

async function updateWithSearch(query: string): Promise<void> {
    const streams = await client.get({url: `https://api.twitch.tv/kraken/search/streams?query=${query}&limit=100`, headers: {'Accept': 'application/vnd.twitchtv.v5+json',"Client-ID":CLIENT_ID}});
    const mappedStreams = mapToStreams(streams);
    const streamsWithTags = await client.get({url: `https://api.twitch.tv/helix/streams?${mappedStreams.map(s => `user_id=${s.userId}`).join('&')}`, headers: {"Client-ID":CLIENT_ID}});
    for (let i = 0;i<mappedStreams.length;i++) {
        const stream = streamsWithTags.data.find(st => st["user_id"] == mappedStreams[i].userId);
        if (stream) {
            mappedStreams[i].tags = await translateTagIDs(stream["tag_ids"]);
        }
    }
    processStreams(mappedStreams);
}

async function translateTagIDs(tagIDs: string[]): Promise<string[]> {
    const result: string[] = [];
    const needed: string[] = [];
    tagIDs.forEach(t => {
        const cached = tagCache.get(t);
        if (cached) {
            result.push(cached);
        } else {
            needed.push(t);
        }
    });
    if (needed.length) {
        const needed_str = needed.map(s => `tag_id=${s}`).join('&');
        const tags = await client.get({url: `https://api.twitch.tv/helix/tags/streams?${needed_str}`, headers: {"Client-ID":CLIENT_ID}});
        tags.data.forEach(t => {
            const name = t["localization_names"]["en-us"];
            const id = t["tag_id"];
            tagCache.set(id, name);
            result.push(name);
        });
    }
    return result;
}

function printTitles(v: any) {
    console.log(v['streams'].map((s: any) => s['channel']['status']).filter((s: string) => s.toLowerCase().includes('bingo')))
}

function printAll(v: any) {
    console.log(JSON.stringify(v, null, 4))
}

function mapToStreams(v: any): Array<Stream> {
    return v['streams'].filter((s: any) => s['channel']['status'].toLowerCase().includes('bingo'))
        .map((s: any) => {return {
            userId: parseInt(s['channel']['_id']),
            username: s['channel']['name'],
            title: s['channel']['status'],
            game: s['channel']['game'],
            tags: [],
        }});
}

function processStreams(streams: Array<Stream>) {
    /*streams.forEach(s => {
        if (activeStreams.has(s.userId)) {
            // do nothing
        } else {
            activeStreams.set(s.userId, s);
            console.log(s);
        }
    })*/
    streams.forEach(s => {
        if (!alreadySeenTitles.has(s.title)) {
            alreadySeenTitles.add(s.title);
            console.log(s);
        }
    })
}

interface Stream {
    readonly userId: number;
    username: string;
    title: string;
    game: string;
    tags: string[];
}