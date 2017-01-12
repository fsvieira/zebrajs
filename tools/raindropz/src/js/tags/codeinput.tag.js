riot.tag2('codeinput', '<div class="content datainput"> <textarea placeholder="Insert state here!!" oninput="{editState}"></textarea> <div class="error {\'hide\': !error, \'show\': error}">{error}</div> <div class="buttons {\'hide\': error, \'show\': !error}"> <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" __disabled="{!text}" onclick="{updateState}"> Run </button> </div> </div>', '', '', function(opts) {
        this.editState = function (e) {
            this.error = undefined;

            if (e.target.value && e.target.value.length > 0) {
                try {
                    JSON.parse(e.target.value);
                    this.text = e.target.value;
                }
                catch (e) {
                    this.text = "";
                    this.error = e;
                }
            }
        };

        this.updateState = function (e) {
            this.opts.trigger("update", {data: this.text});
            riot.route("datashow");
        };
});
