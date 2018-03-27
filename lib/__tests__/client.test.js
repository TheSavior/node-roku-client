/* eslint-env jest */
/* global fetch */

import fs from 'fs';
import path from 'path';
import stream from 'stream';
import Client from '../client';

const clientAddr = 'http://192.168.1.61:8060';

function loadResponse(name, asBuffer = false) {
  const file = name.includes('.') ? name : `${name}.xml`;
  const data = fs.readFileSync(path.join(__dirname, 'assets', file));
  if (!asBuffer) {
    return data.toString('utf-8');
  }
  const bufferStream = new stream.PassThrough();
  bufferStream.end(data);
  return bufferStream;
}

describe('Client', () => {
  let client;

  beforeEach(() => {
    client = new Client(clientAddr);
    fetch.mockClear();
  });

  describe('#constructor()', () => {
    it('should construct a new Client object', () => {
      expect(client).toBeDefined();
      expect(client.ip).toEqual(clientAddr);
    });
  });

  describe('#apps()', () => {
    it('should return a list of apps', () => {
      fetch.mockResponse(loadResponse('apps'));
      return client.apps()
        .then((apps) => {
          expect(apps).toBeInstanceOf(Array);
          apps.forEach((app) => {
            expect(app).toEqual(expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              type: expect.any(String),
              version: expect.any(String),
            }));
          });
        });
    });
  });

  describe('#active()', () => {
    it('should return the active app', () => {
      fetch.mockResponse(loadResponse('active-app'));
      return client.active()
        .then((app) => {
          expect(app).toEqual(expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            type: expect.any(String),
            version: expect.any(String),
          }));
        });
    });

    it('should return null if there is not an active app', () => {
      fetch.mockResponse(loadResponse('active-app-none'));
      return client.active()
        .then((app) => {
          expect(app).toBeNull();
        });
    });

    it('should reject if multiple apps are returned', () => {
      fetch.mockResponse(loadResponse('active-multiple'));
      return client.active()
        .then(() => {
          throw new Error('Should have thrown');
        }).catch((err) => {
          expect(err).toBeDefined();
          expect(err).toBeInstanceOf(Error);
        });
    });
  });

  describe('#info()', () => {
    it('should return info for the roku device', () => {
      fetch.mockResponse(loadResponse('info'));
      return client.info()
        .then((info) => {
          expect(info).toBeInstanceOf(Object);
          expect(Object.keys(info).length).toEqual(29);
          expect(info['model-name']).toBeUndefined();
          expect(info.modelName).toEqual('Roku 3');
        });
    });
  });

  describe('#keypress()', () => {
    it('should press the home button', () =>
      client
        .keypress('Home')
        .then(() => {
          expect(fetch)
            .toHaveBeenCalledWith(`${clientAddr}/keypress/Home`, { method: 'POST' });
        }));

    it('should send a Lit_ command if a single character is passed in', () => {
      client
        .keypress('a')
        .then(() => {
          expect(fetch)
            .toHaveBeenCalledWith(`${clientAddr}/keypress/Lit_a`, { method: 'POST' });
        });
    });

    it('should url encode Lit_ commands for utf-8 characters', () => {
      client
        .keypress('€')
        .then(() => {
          expect(fetch)
            .toHaveBeenCalledWith(`${clientAddr}/keypress/Lit_%E2%82%AC`, { method: 'POST' });
        });
    });
  });

  describe('#keydown()', () => {
    it('should press and hold the pause', () =>
      client
        .keydown('Pause')
        .then(() => {
          expect(fetch)
            .toHaveBeenCalledWith(`${clientAddr}/keydown/Pause`, { method: 'POST' });
        }));
  });

  describe('#keyup()', () => {
    it('should release the info button', () =>
      client
        .keyup('Info')
        .then(() => {
          expect(fetch)
            .toHaveBeenCalledWith(`${clientAddr}/keyup/Info`, { method: 'POST' });
        }));
  });

  describe.skip('#icon()', () => {
    it('should download the icon to the given folder', () => {
      fetch.mockImplementation(() => {
        const response = new fetch.Response(loadResponse('netflix.jpeg', true));
        response.headers = new fetch.Headers({ 'content-type': 'image/jpeg' });
        return Promise.resolve(response);
      });
      return client
        .icon('12')
        .then((res) => {
          expect(fs.existsSync(res)).toBeTruthy();
          expect(res.endsWith('.jpeg'));
          fs.unlinkSync(res);
        });
    });
  });

  describe('#launch()', () => {
    it('should call launch for the given app id', () =>
      client.launch('12345')
        .then(() => {
          expect(fetch)
            .toHaveBeenCalledWith(`${client.ip}/launch/12345`, { method: 'POST' });
        }));
  });

  describe('#text()', () => {
    it('should send a Lit_ command for each letter', () =>
      client.text('hello')
        .then(() => {
          expect(fetch.mock.calls)
            .toEqual([
              [`${client.ip}/keypress/Lit_h`, { method: 'POST' }],
              [`${client.ip}/keypress/Lit_e`, { method: 'POST' }],
              [`${client.ip}/keypress/Lit_l`, { method: 'POST' }],
              [`${client.ip}/keypress/Lit_l`, { method: 'POST' }],
              [`${client.ip}/keypress/Lit_o`, { method: 'POST' }],
            ]);
        }));
  });

  describe('#command()', () => {
    it('should allow chaining remote commands', () =>
      client.command()
        .volumeUp()
        .select()
        .text('abc')
        .send()
        .then(() => {
          expect(fetch.mock.calls)
            .toEqual([
              [`${client.ip}/keypress/VolumeUp`, { method: 'POST' }],
              [`${client.ip}/keypress/Select`, { method: 'POST' }],
              [`${client.ip}/keypress/Lit_a`, { method: 'POST' }],
              [`${client.ip}/keypress/Lit_b`, { method: 'POST' }],
              [`${client.ip}/keypress/Lit_c`, { method: 'POST' }],
            ]);
        }));
  });
});
