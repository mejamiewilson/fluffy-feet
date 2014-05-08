var app;
$(function() {

	var settingsLocation = window.location.href.indexOf("localhost") !== -1 ? "./hoist.json" : "/settings";

	$.getJSON(settingsLocation, function(settings) {

		Hoist.apiKey(settings.apiKey);

		//Account Controller
		window.account = new AccountManager();

		//If logged in, start the app, or show the login screen
		Hoist.status(function(member) {
			app = new App(member);
		}, function() {
			account.drawLogin();
		});

	});

	//Blur element tracking

  window.clicky;

  $(document).mousedown(function(e) {
      clicky = $(e.target);
  });

  $(document).mouseup(function(e) {
      clicky = null;
  });

});

var App = function(member) {

	var self = this,
			structure = _.template($("#page_structure").html()),
			body = _.template($("#page_body").html()),
			navigation = _.template($("#page_navigation").html()),
			fin;

	this.member = member;

	//Draw the page content
	$("#content").html(structure()).append(body());

	//The Hoist "Data Manager" doesn't store the result of a collection
	//on get, so we have two separate objects to update
	this._posts = Hoist("posts");
	this.posts;

	this._members = Hoist("members");
	this.members;


	//Get the members
	console.log(window.app, app, "yes?");
	this._members.get(function(res) {

		$("nav .content").append(navigation(app));

		//Store the members in the app
		self.members = res;
		//get the member who is just logged in
		self.member.name = _.find(self.members, function(m) {
			return m.id === self.member.id;
		}).name;

		//Attach event handlers
		self.attachEvents();

		self.loadPosts(function() {
			account.loadProfileImages(self.members);
			self.startPoll();
		});


	});

};

_.extend(App.prototype, {

	attachEvents: function() {
		//attach event handlers
		$("textarea")
			.on("focus", this.focusTextarea)
			.on("blur", this.blurTextarea);

		$(".mode")
			.on("click", this.changeMode);

		$("#post-status")
			.on("click", this.postStatus);

		$("body")
			.on("click", ".js-delete-post", this.deleteStatus);

		$("body")
			.on("click", ".js-logout", this.logout);
	},

	focusTextarea: function() {

		$("#comments-actions").show();
		$("#preview").show();
		if($("textarea").val() === "Write something here") {
			$("textarea").val('');
		}

	},
	blurTextarea: function(e) {

		if($("textarea").val() == '') { $("textarea").val('Write something here'); }
		if($(e.relatedTarget).attr("id") === "post-status" || $(clicky).hasClass("mode")) {

		} else {
			$("#comments-actions").hide();
			$("#preview").hide();
		}

	},
	changeMode: function(e) {

		if($(e.target).attr("id") === "preview") {
			$(".mode").removeClass("active");
			$("#preview").addClass("active");
			$("textarea").hide();
			var c = strip($("textarea").val());
			$("#content-preview").show().html(marked(strip($("textarea").val())));
		} else {
			$(".mode").removeClass("active");
			$("#write").addClass("active");
			$("textarea").show();
			$("#content-preview").hide().html('');
		}

	},
	postStatus: function() {

		var content = $("textarea").val();
		if(content == "") return;
		$("textarea").val("Write something here");

		var post = {
			text: strip(content),
			media: "",
			ownerId: this.member.id
		};

		this._posts.post(post);
		this.drawPost(post);

		//app._posts.post(post);

		$("#comments-actions").hide();
		$("#preview").hide();

	},

	logout: function() {
		Hoist.logout(function() {
			account.drawLogin();
		});
	},

	getUser: function(id) {

		var user = _.find(this.members, function(m) {
			return m.id === id;
		});
		return user;

	},

	loadPosts: function(success) {

		var self = this;
		this._posts.get(function(res) {
			//Store the posts in the app
			self.posts = res;
			$(".loading").remove();
			//Loop through the posts to draw them
			_.each(res, function(r) {
				self.drawPost(r);
			}, this);
			success();
		});

	},

	drawPost: function(post) {

		//making it one level deep to make underscore templates easier
		//to work with
		post.post = post;
		post.post.markedDownText = marked(post.post.text);
		//Get the user from the members array
		post.user = this.getUser(post.ownerId) || {};
		post.isEditable = post.ownerId === this.member.id;

		var template = _.template($("#post").html());
		var post_html = template(post);
		$("#content-placeholder").prepend(post_html);

	},

	deleteStatus: function() {

		var c = confirm("Are you sure you want to delete this post?");
		if(c) {
			//get the id
			var id = $(this).data("post");
			//delete the post
			$(".media[data-post='"+ id +"']").remove();
			//delete from the app
			this._posts.remove(id);
		}

	},
	//Poll for changes
	startPoll: function() {
		console.log("START POLL");
		var self = this;
		this.lastUpdated = Date.now();
		setTimeout(app.poll, 2000);
	},
	poll: function() {

		app._posts.get({
			q: {
				"_createdDate" : { "$gt" : app.lastUpdated }
			}
		}, app.drawFromPoll);

	},
	drawFromPoll: function(posts) {

		var self = this;
		this.startPoll();
		_.each(posts, function(p) {
			self.posts.push(p);
			self.drawPost(p);
		});

	}
});


//Helpers
function strip(html)
{
	var tmp = document.createElement("DIV");
	tmp.innerHTML = html;
	return tmp.textContent || tmp.innerText || "";
}
