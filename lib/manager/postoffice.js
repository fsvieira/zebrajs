
// TODO: we need to async all calls in case we start performing remote operation, 
// this needs a normalized promise api. 

class PostOffice {
    constructor () {
        this.resources = {};
        this.ids = 1;
    }

    register (username, description) {
        return new Promise(resolve => {
            const id = this.ids++;
            const stringId = `${id}@${username}`;

            this.resources[stringId] = {
                username,
                id,
                description,
                stats: {
                    actives: 0,
                },
                closed: false,
                data: [],
                listenners: [],
                pull: []
            };

            resolve(stringId);
        });
    }

    remove (id) {
        return new Promise((resolve) => {
            delete this.resources[id];
            resolve(id);
        });
    }

    async push (id, data) {
        const resource = await this.getResource(id);

        if (resource.closed) {
            throw `Resource is alredy closed!!`;
        }
        else {
            resource.data.push(data);

            for (let i=0; i<resource.listenners.length; i++) {
                const f = resource.listenners[i];
                f(data);
            }
        }

        return this;
    }

    async addActives (id, actives) {
        const resource = await this.getResource(id);

        if (!resource.closed) {
            resource.stats.actives += actives;
        }

        return resource.stats.actives;        
    }

    async subActives (id, actives) {
        const resource = await this.getResource(id);
        
        if (!resource.closed) {
            resource.stats.actives -= actives;
        }

        if (resource.stats.actives === 0) {
            resource.closed = true;

            while (resource.pull.length) {
                const f = resource.pull.pop();

                f(resource.data);
            }
        }


        return resource.stats.actives;
    }

    async abort (id, reason) {
        const resource = await this.getResource(id);
        
        resource.data = [reason];

        resource.stats.actives = 0;
        resource.close = true;

        this.subActives(id, 0);
    }

    getResource (id) {
        return new Promise((resolve, reject) => {
            const resource = this.resources[id];

            if (resource) {
                resolve(resource);
            }
            else {
                reject(`Resource ${id} is not registered!!`);
            }
        });
    }

    async partialPull (id) {
        const resource = await this.getResource(id);
        return resource.data;
    }

    async pull (id) {
        const resource = await this.getResource(id);

        return new Promise(resolve => {
            resource.pull.push(resolve);
            this.subActives(id, 0);
        });
    }

    async listen (id, callback) {
        const resource = await this.getResource(id);

        const data = await this.partialPull(id);

        for (let i=0; i<data.length; i++) {
            // send current values to new listenner,
            callback(data[i]);
        }

        resource.listenners.push(callback);

        return this;
    }
}


module.exports = PostOffice;
