/* =======================================================
	Copyright 2018 - ePortfolium - Licensed under the
	Educational Community License, Version 2.0 (the "License"); you may
	not use this file except in compliance with the License. You may
	obtain a copy of the License at

	http://opensource.org/licenses/ECL-2.0

	Unless required by applicable law or agreed to in writing,
	software distributed under the License is distributed on an "AS IS"
	BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
	or implied. See the License for the specific language governing
	permissions and limitations under the License.
   ======================================================= */

var g_xmlDoc = null;
var g_json = {};
var g_trees = {};
var g_noline = 0;
var g_actions = [];
var g_actions_list = [];
var g_current_node_uuid = null;
var g_users = {};
//-----------------------

var jqueryBatchSpecificFunctions = {};
jqueryBatchSpecificFunctions['.resourceTextContains('] = "asmResource[xsi_type!='context'][xsi_type!='nodeRes']>text[lang='#lang#']:contains(";
jqueryBatchSpecificFunctions['.resourceCodeContains('] = "asmResource[xsi_type!='context'][xsi_type!='nodeRes']>code:contains(";
jqueryBatchSpecificFunctions['.resourceValueContains('] = "asmResource[xsi_type!='context'][xsi_type!='nodeRes']>value:contains(";
jqueryBatchSpecificFunctions['.nodeLabelContains('] = "asmResource[xsi_type='nodeRes']>label[lang='#lang#']:contains(";
jqueryBatchSpecificFunctions['.nodeCodeContains('] = "asmResource[xsi_type='nodeRes']>code:contains(";
jqueryBatchSpecificFunctions['.resourceFilenameContains('] = "asmResource[xsi_type!='context'][xsi_type!='nodeRes']>filename[lang='#lang#']:contains(";

//==================================
function getTest(test)
//==================================
{
	for (fct in jqueryBatchSpecificFunctions) {
		if (test.indexOf(fct)>-1) {
			test = ".has(\"" + test.replace(fct,jqueryBatchSpecificFunctions[fct]) + "\")";
			if (test.indexOf("#lang#")>-1)
				test = test.replace(/#lang#/g,languages[LANGCODE]);
		}
	}
	return test;
}

//==================================
function initBatchVars()
//==================================
{
	g_xmlDoc = null;
	g_json = {};
	g_trees = {};
	g_noline = 0;
}

//-----------------------------------------------------------------------
//==================================
function replaceBatchVariable(text,node,withquote)
//==================================
{
	if (withquote==null)
		withquote = true;
	if (text!=undefined && text.indexOf('lastimported')>-1) {
		text = text.replaceAll('###lastimported-1###',"g_importednodestack[g_importednodestack.length-2]");
		text = text.replaceAll('###lastimported-2###',"g_importednodestack[g_importednodestack.length-3]");
		text = text.replaceAll('###lastimported###',"g_importednodestack[g_importednodestack.length-1]");
	}
	if (node!=null && node!=undefined && withquote && text.indexOf('###parentnode###')>-1)
		text = text.replaceAll('###parentnode###',"'"+$(node).parent().attr('id')+"'");
	if (node!=null && node!=undefined && withquote && text.indexOf('###currentnode###')>-1)
		text = text.replaceAll('###currentnode###',"'"+node.id+"'");
	if (node!=null && node!=undefined && withquote && text.indexOf('###currentcode###')>-1)
		text = text.replaceAll('###currentcode###',node.getCode());
	if (node!=null && node!=undefined && !withquote && text.indexOf('###currentnode###')>-1)
		text = text.replaceAll('###currentnode###',node.id);
	if (node!=null && node!=undefined && !withquote && text.indexOf('###currentcode###')>-1)
		text = text.replaceAll('###currentcode###',node.getCode());
	var n=0;
	while (text!=undefined && text.indexOf("{###")>-1 && n<100) {
		var test_string = text.substring(text.indexOf("{###")+4); // test_string = abcd{###variable###}efgh.....
		var variable_name = test_string.substring(0,test_string.indexOf("###}"));
		if (g_variables[variable_name]!=undefined)
			text = text.replace("###"+variable_name+"###", g_variables[variable_name]);
		else if (eval("g_json."+variable_name)!=undefined)
			text = text.replace("###"+variable_name+"###", eval("g_json."+variable_name));
		else if (eval("g_json.lines["+g_noline+"]."+variable_name)!=undefined)
			text = text.replace("###"+variable_name+"###", eval("g_json.lines["+g_noline+"]."+variable_name));
		n++; // to avoid infinite loop
	}
	while (text!=undefined && text.indexOf("###")>-1 && n<100) {
		var test_string = text.substring(text.indexOf("###")+3); // test_string = abcd###variable###efgh.....
		var variable_name = test_string.substring(0,test_string.indexOf("###"));
		if (g_variables[variable_name]!=undefined)
			text = text.replace("###"+variable_name+"###", g_variables[variable_name]);
		else if (eval("g_json."+variable_name)!=undefined)
			text = text.replace("###"+variable_name+"###", eval("g_json."+variable_name));
		else if (eval("g_json.lines["+g_noline+"]."+variable_name)!=undefined)
			text = text.replace("###"+variable_name+"###", eval("g_json.lines["+g_noline+"]."+variable_name));
		if (text.indexOf("[")>-1) {
			var variable_value = variable_name.substring(0,variable_name.indexOf("["))
			var i = text.substring(text.indexOf("[")+1,text.indexOf("]"));
			i = replaceVariable(i);
			if (g_variables[variable_value]!=undefined && g_variables[variable_value].length>=i)
				text = g_variables[variable_value][i];
		}
		n++; // to avoid infinite loop
	}
	return text;
}
//-----------------------------------------------------------------------

//==================================
function getTxtvals(node,cleancode)
//==================================
{
	var str = getTxtvalsWithoutReplacement(node);
	str = replaceBatchVariable(str.trim());
	if (cleancode!=null && cleancode) // ne pas faire cleancode pour les usagers avec un @ et pour les textes avec un &
		str = cleancode(str);
	return str;
}

//==================================
function b_replaceVariable(text)
//==================================
{
	if (text.indexOf("//")>-1)
		text = eval("g_json."+text.substring(2));
	return text;
}

//==================================
function getTxtvalsWithoutReplacement(node)
//==================================
{
	var str = "";
	var txtvals = $("txtval",node);
	for (var i=0; i<txtvals.length; i++){
		var select = $(txtvals[i]).attr("select");
		var text = "";
		if (select!=undefined && select!="") {
			var fct = null;
			//---------- function ---
			if (select.indexOf('function(')>-1) {
				fct = select.substring(9,select.indexOf(','))
				select = select.substring(select.indexOf(',')+1,select.indexOf(')'))
			}
			//---------- text ------
			if (select.indexOf("//")>-1) {
				if (select=="//today")
					text = new Date().toLocaleString();
				else
					text = eval("g_json."+select.substring(2));
			} else if (select.indexOf("/")>-1) {
				text = eval("g_users['"+select.substring(1)+"']");
			} else if (select.indexOf("##")>-1)
				text = replaceVariable(select);
			else
				text = eval("g_json.lines["+g_noline+"]."+select);
			//---------- function ---
			if (fct!=null)
				text = eval(fct+"('"+text+"')");
			//-------------
		} else {
			text = $(txtvals[i]).text();
			if (text=="//today")
				text = new Date().toLocaleString();
			if (text.indexOf('numline()')>-1) {
				text = text.replace(/numline()/g,g_noline);
				text = eval(text);
			}
		}
		str += text;
	}
	return str.trim();
}

//==================================
function getvarvals(node)
//==================================
{
	var str = "";
	if ($("varval",node).length>0) {
		var txtvarval = $("varval",node).text();
		var items = txtvarval.split("|");
		for (var i=0; i<items.length; i++){
			var text = "";
			if (items[i]!=undefined && items[i]!="") {
				var fct = null;
			//---------- function ---
				if (items[i].indexOf('function(')>-1) {
					fct = items[i].substring(9,items[i].indexOf(','));
					items[i] = items[i].substring(items[i].indexOf(',')+1,items[i].indexOf(')'));
				}
			//---------- text ---
				if (select.indexOf("//")>-1) {
					if (select=="//today")
						text = new Date().toLocaleString();
					else
						text = eval("g_json."+select.substring(2));
				} else if (items[i].indexOf("/")>-1)
					text = eval("g_json.lines["+g_noline+"]."+items[i].substring(1));
				else 
					text = items[i];
			//---------- function ---
				if (fct!=null)
					text = eval(fct+"('"+text+"')");
			//---------- numline ---
				if (text!=undefined && text.indexOf('numline()')>-1) {
					text = text.replace(/numline()/g,g_noline);
					text = eval(text);
				}
			}
			str += text;
		}
	}
	return replaceVariable(str.trim());
}

//==================================
function getTargetUrl(node)
//==================================
{
	var url = "";
	var select = $(node).attr("select");
	var idx = select.lastIndexOf(".");
	var treeref = select.substring(0,idx);
	var semtag = select.substring(idx+1);
	if (semtag=='#current_node')
		url = serverBCK_API+"/nodes/node/"+g_current_node_uuid;
	else if (semtag=='#uuid') {
		if (treeref.indexOf("//")>-1)
			treeref = eval("g_json."+treeref.substring(2));
		else if (treeref.indexOf("/")>-1)
			treeref = eval("g_json.lines["+g_noline+"]."+treeref.substring(1));
		else if (treeref.indexOf("##")>-1)
			treeref = replaceVariable(treeref);
		url = serverBCK_API+"/nodes/node/"+treeref;
	} else if (treeref.indexOf("#")>-1)
		url = serverBCK_API+"/nodes?portfoliocode=" + treeref.substring(1) + "&semtag="+semtag;	
	else
		url = serverBCK_API+"/nodes?portfoliocode=" + g_trees[treeref][1] + "&semtag="+semtag;
	return url;
//	return replaceVariable(url);
}

//==================================
function getSemtag(node)
//==================================
{
	var select = $(node).attr("select");
	var idx = select.lastIndexOf(".");
	var semtag = select.substring(idx+1);
	return semtag;
}

//==================================
function getSourceUrl(node)
//==================================
{
	var url = "";
	var select = $("source",node).attr("select");
	var idx = select.lastIndexOf(".");
	var treeref = select.substring(0,idx);
	var semtag = select.substring(idx+1);
	if (semtag=='#current_node')
		url = serverBCK_API+"/nodes/node/"+g_current_node_uuid;
	else if (semtag=='#uuid') {
		if (treeref.indexOf("//")>-1)
			treeref = eval("g_json."+treeref.substring(2));
		else if (treeref.indexOf("/")>-1)
			treeref = eval("g_json.lines["+g_noline+"]."+treeref.substring(1));
		else if (treeref.indexOf("##")>-1)
			treeref = replaceVariable(treeref);
		if (treeref!='#none')
			url = serverBCK_API+"/nodes/node/"+treeref;
	} else if (treeref.indexOf("#")>-1)
		url = serverBCK_API+"/nodes?portfoliocode=" + treeref.substring(1) + "&semtag="+semtag;	
	else
		url = serverBCK_API+"/nodes?portfoliocode=" + g_trees[treeref][1] + "&semtag="+semtag;
	return url;
//	return replaceVariable(url);
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//================================================
function processAll(model_code,portfoliologcode)
//=================================================
{
	$.ajaxSetup({async: false});
//	if (USER.creator){
//		get_list_portfoliosgroups();
//		get_list_usergroups();
//	}
	var actions_list = $("model",g_xmlDoc).children();
	processListActions(actions_list);
	$("#batch-log").append("<br>=============== THIS IS THE END ===============================");
	$.ajaxSetup({async: true});
	//--------------------
	if (portfoliologcode!="")
		saveLog(model_code,portfoliologcode,$("#batch-log").html());
	//--------------------
	if (g_execbatch) { // after creation of portfolio
		window.location.reload();
	}
}

//=================================================
function processListActions(list)
//=================================================
{
	for (var i=0; i<list.length; i++){
		var actiontype = $(list[i]).prop("nodeName");
		var actionnode = list[i];
		if (actiontype!='for-each-line' && actiontype!='if-then-else') {
			$("#batch-log").append("<br>------------- "+actiontype+" -----------------");
			g_actions[actiontype](actionnode);
			previous_action = actiontype;
		}
		if (actiontype=='for-each-line') {
			for (j=0; j<g_json.lines.length; j++){
				g_noline = j;
				$("#batch-log").append("<br>================ LINE "+(g_noline+1)+" =============================");
				processListActions($(actionnode).children());
			}
		}
		if (actiontype=='if-then-else') {
			var if_action = $('if-part',actionnode).children()[0]; // only one action in test
			var then_actions = $($('>then-part',actionnode)[0]).children();
			var else_actions = $($('>else-part',actionnode)[0]).children();
			var actiontype = $(if_action).prop("nodeName");
			var actionnode = if_action;
			$("#batch-log").append("<br>================ IF ===============================");			
			if (g_actions[actiontype](actionnode)){
				$("#batch-log").append("<br>================ THEN =============================");			
				processListActions(then_actions);
			}
			else {
				$("#batch-log").append("<br>================ ELSE =============================");			
				processListActions(else_actions);
			}
			$("#batch-log").append("<br>================ END IF ============================");			
		}
	}
};


//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//---------------------------FOR EACH TREE ------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['for-each-tree'] = function forEachTree(node)
//=================================================
{
	var code = getTxtvals($("code",node));
	var url1 = serverBCK_API+"/portfolios?active=1&search="+code;
	$.ajax({
		async: false,
		type : "GET",
		dataType : "xml",
		url : url1,
		code : code,
		success : function(data) {
			var nb = parseInt($('portfolios',data).attr('count'));
			$("#batch-log").append("<br> Number of trees :"+nb);
			var trees = $("portfolio",data);
			for (var i=0; i<trees.length; i++){
				var portfolio = new Array();
				portfolio [0] = $(trees[i]).attr("id");
				portfolio [1] = $("code",$("asmRoot>asmResource[xsi_type='nodeRes']",trees[i])).text();
				var treeref = $(node).attr('id');
				g_trees[treeref] = portfolio;
			$("#batch-log").append("<br>------------- current-tree -----------------");
				$("#batch-log").append("<br>- tree selected - code:"+portfolio [1]+" - portfolioid:"+portfolio [0]);
				processListActions($("actions",node).children());
			}
		}
	});
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//---------------------------FOR EACH USER ------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------


//==================================
g_actions['for-each-user'] = function (node)
//==================================
{
	var username = getTxtvals($("username",node));
	var email = getTxtvals($("email",node));
	if (username!="")
		$.ajax({
			async: false,
			type : "GET",
			dataType : "xml",
			url : serverBCK_API+"/users?username="+username,
			success : function(data) {
				UIFactory["User"].parse(data);
				for ( var j = 0; j < UsersActive_list.length; j++) {
					var username = UsersActive_list[j].username_node.text();
					var userref = $(node).attr('id');
					g_users[userref] = username;
			$("#batch-log").append("<br>------------- current-user -----------------");
					$("#batch-log").append("<br>- user selected - username:"+username);
					processListActions($("actions",node).children());
						//------------------------------------
				}
			}
		});
	else
		$.ajax({
			async: false,
			type : "GET",
			dataType : "xml",
			url : serverBCK_API+"/users?email="+email,
			success : function(data) {
				UIFactory["User"].parse(data);
				for ( var j = 0; j < UsersActive_list.length; j++) {
					var username = UsersActive_list[j].username_node.text();
					var userref = $(node).attr('id');
					g_users[userref] = username;
					$("#batch-log").append("<br>- user selected - username:"+username);
					processListActions($("actions",node).children());
						//------------------------------------
				}
			}
		});
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------------ User -----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------


//=================================================
g_actions['create-user'] = function createUser(node)
//=================================================
{
	var ok = false;
	var identifier = getTxtvals($("identifier",node));
	var lastname = getTxtvals($("lastname",node));
	var firstname = getTxtvals($("firstname",node));
	var email = getTxtvals($("email",node));
	var designer = getTxtvals($("designer",node));
	var password = getTxtvals($("password",node));
	var other = getTxtvals($("other",node));
	if (designer==undefined || designer=='')
		designer ='0';
	//---- get userid ----------
	var userid = "";
	var url = serverBCK_API+"/users/user/username/"+identifier;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			userid = data;
			ok = true;
			$("#batch-log").append("<br>- user already defined("+userid+") - identifier:"+identifier+" lastname:"+lastname+" firstname:"+firstname);
			var xml = "";
			xml +="<?xml version='1.0' encoding='UTF-8'?>";
			xml +="<user>";
			xml +="	<username>"+identifier+"</username>";
			xml +="	<lastname>"+lastname+"</lastname>";
			xml +="	<firstname>"+firstname+"</firstname>";
			xml +="	<email>"+email+"</email>";
//			xml +="	<password>"+password+"</password>"; user may have changed his/her password
			xml +="	<active>1</active>";
			xml +="	<other>"+other+"</other>";
			xml +="	<admin>0</admin>";
			xml +="	<designer>"+designer+"</designer>";
			xml +="</user>";
			var url = serverBCK_API+"/users/user/"+userid;
			$.ajax({
				async : false,
				type : "PUT",
				contentType: "application/xml; charset=UTF-8",
				dataType : "text",
				url : url,
				data : xml,
				success : function(data) {
					userid = data;
					ok = true;
					$("#batch-log").append("<br>- user updated("+userid+") - identifier:"+identifier+" lastname:"+lastname+" firstname:"+firstname);
				},
				error : function(data) {
					$("#batch-log").append("<br>- ***<span class='danger'>ERROR 1</span> in create/update-user ("+userid+") - identifier:"+identifier+" lastname:"+lastname+" firstname:"+firstname);					
				}
			});
			},
		error : function(data) {
			var xml = "";
			xml +="<?xml version='1.0' encoding='UTF-8'?>";
			xml +="<users>";
			xml +="<user>";
			xml +="	<username>"+identifier+"</username>";
			xml +="	<lastname>"+lastname+"</lastname>";
			xml +="	<firstname>"+firstname+"</firstname>";
			xml +="	<email>"+email+"</email>";
			xml +="	<password>"+password+"</password>";
			xml +="	<active>1</active>";
			xml +="	<other>"+other+"</other>";
			xml +="	<admin>0</admin>";
			xml +="	<designer>"+designer+"</designer>";
			xml +="</user>";
			xml +="</users>";
			var url = serverBCK_API+"/users";
			$.ajax({
				async : false,
				type : "POST",
				contentType: "application/xml; charset=UTF-8",
				dataType : "text",
				url : url,
				data : xml,
				success : function(data) {
					userid = data;
					ok = true;
					$("#batch-log").append("<br>- user created("+userid+") - identifier:"+identifier+" lastname:"+lastname+" firstname:"+firstname);
				},
				error : function(data) {
					$("#batch-log").append("<br>- ***<span class='danger'>ERROR 2</span> in create-user ("+userid+") - identifier:"+identifier+" lastname:"+lastname+" firstname:"+firstname);					
				}
			});
		}
	});
	return ok;
};

function updateUserAttribute(data,attribute,value) {
		if (value!="" && $(attribute,data).text()!=value) {
		$(attribute,data).text(value);
	}
}
//=================================================
g_actions['update-user'] = function updateUser(node)
//=================================================
{
	var ok = false;
	var identifier = getTxtvals($("identifier",node));
	var newlastname = getTxtvals($("lastname",node));
	var newfirstname = getTxtvals($("firstname",node));
	var newemail = getTxtvals($("email",node));
	var newdesigner = getTxtvals($("designer",node));
	var newadmin = getTxtvals($("admin",node));
	var newpassword = getTxtvals($("password",node));
	var newother = getTxtvals($("other",node));
	//---- get userid ----------
	var userid = "";
	var url = serverBCK_API+"/users/user/username/"+identifier;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			userid = data;
			var url = serverBCK_API+"/users/user/"+userid;
			$.ajax({
				async : false,
				type : "GET",
				contentType: "application/xml",
				dataType : "xml",
				url : url,
				success : function(data) {
					ok = true;
					updateUserAttribute(data,"lastname",newlastname)
					updateUserAttribute(data,"firstname",newfirstname)
					updateUserAttribute(data,"email",newemail)
					updateUserAttribute(data,"designer",newdesigner)
					updateUserAttribute(data,"admin",newadmin)
					updateUserAttribute(data,"password",newpassword)
					updateUserAttribute(data,"other",newother)
					var newdata = "<user>" + $(":root",data).html() + "</user>";
					var strippeddata = newdata.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
					var url = serverBCK_API+"/users/user/"+userid;
					$.ajax({
						async : false,
						type : "PUT",
						contentType: "application/xml; charset=UTF-8",
						dataType : "text",
						url : url,
						data : strippeddata,
						success : function(data) {
							userid = data;
							ok = true;
							$("#batch-log").append("<br>- user updated("+userid+") - identifier:"+identifier);
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***<span class='danger'>ERROR 1</span> in update-user ("+userid+") - identifier:"+identifier);
						}
					});
				},
				error : function(data) {
					$("#batch-log").append("<br>- ***<span class='danger'>ERROR 2</span> in update-user ("+userid+") - identifier:"+identifier);
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR 3</span> in update-user ("+userid+") - identifier:"+identifier);
		}
	});
	return ok;
};

//=================================================
g_actions['delete-user'] = function deleteUser(node)
//=================================================
{
	var ok = false;
	var identifier = getTxtvals($("identifier",node));
	var userref = $(node).attr("select");
	if (userref!=="")
		identifier = g_users[userref];
	//---- get userid ----------
	var userid = "";
	var url = serverBCK_API+"/users/user/username/"+identifier;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			userid = data;
			var url = serverBCK_API+"/users/user/" + userid;
			$.ajax({
				async : false,
				type : "DELETE",
				dataType : "text",
				url : url,
				data : "",
				success : function(data) {
					ok = true;
					$("#batch-log").append("<br>- user deleted("+userid+") - identifier:"+identifier);
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR</span> user does not exist - identifier:"+identifier);
		}
	});
	return ok;
}

//=================================================
g_actions['inactivate-user'] = function inactivateUser(node)
//=================================================
{
	var ok = false;
	var identifier = getTxtvals($("identifier",node));
	var userref = $(node).attr("select");
	if (userref!=="")
		identifier = g_users[userref];
	//---- get userid ----------
	var userid = "";
	var url = serverBCK_API+"/users/user/username/"+identifier;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			userid = data;
			var url = serverBCK_API+"/users/user/" + userid;
			$.ajax({
				async : false,
				type : "GET",
				contentType: "application/xml",
				dataType : "xml",
				url : url,
				success : function(data) {
					$("active",data).text('0');
					data = xml2string(data);
					$.ajax({
						async : false,
						type : "PUT",
						dataType : "text",
						url : url,
						data : data,
						success : function(data) {
							ok = true;
							$("#batch-log").append("<br>- user inactived ("+userid+") - identifier:"+identifier);
						},
						error : function(data) {
							$("#batch-log").append("<br>- <span class='danger'>ERROR</span> cannot inactivate user - identifier:"+identifier);
						}
					});
				},
				error : function(data) {
					$("#batch-log").append("<br>- <span class='danger'>ERROR</span> cannot get user info - identifier:"+identifier);
				}

			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- NOT FOUND <span class='danger'>ERROR</span> user does not exist - identifier:"+identifier);
		}
	});
	return ok;
}

///=================================================
g_actions['activate-user'] = function activateUser(node)
//=================================================
{
	var ok = false;
	var identifier = getTxtvals($("identifier",node));
	var userref = $(node).attr("select");
	if (userref!=="")
		identifier = g_users[userref];
	//---- get userid ----------
	var userid = "";
	var url = serverBCK_API+"/users/user/username/"+identifier;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			userid = data;
			var url = serverBCK_API+"/users/user/" + userid;
			$.ajax({
				async : false,
				type : "GET",
				contentType: "application/xml",
				dataType : "xml",
				url : url,
				success : function(data) {
					$("active",data).text('1');
					data = xml2string(data);
					$.ajax({
						async : false,
						type : "PUT",
						dataType : "text",
						url : url,
						data : data,
						success : function(data) {
							ok = true;
							$("#batch-log").append("<br>- user actived ("+userid+") - identifier:"+identifier);
						},
						error : function(data) {
							$("#batch-log").append("<br>- <span class='danger'>ERROR</span> cannot activate user - identifier:"+identifier);
						}
					});
				},
				error : function(data) {
					$("#batch-log").append("<br>- <span class='danger'>ERROR</span> cannot get user info - identifier:"+identifier);
				}

			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- NOT FOUND <span class='danger'>ERROR</span> user does not exist - identifier:"+identifier);
		}
	});
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//-------------------------------- User Group ---------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['create-usergroup'] = function CreateUserGroup(node)
//=================================================
{
	var ok = false;
	var usergroup = getTxtvals($("usergroup",node));
	var url = serverBCK_API+"/usersgroups?label="+usergroup;
	$.ajax({
		async : false,
		type : "POST",
		contentType: "application/xml; charset=UTF-8",
		dataType : "text",
		url : url,
		success : function(data) {
			ok = true;
			var usergroupid = data;
			get_list_usergroups();
			$("#batch-log").append("<br>- usergroup created - label:"+usergroup);
		},
		error : function(data) {
			$("#batch-log").append("<br>- *** already defined - label:"+usergroup);
		}
	});
	return ok;
}

//=================================================
g_actions['join-usergroup'] = function JoinUserGroup(node)
//=================================================
{
	var ok = false;
	var user = "";
	var usergroup = getTxtvals($("usergroup",node));
	var select_user = $("user>txtval",node).attr("select");
	if(typeof(select_user)=='undefined')
		user = $("user>txtval",node).text();
	else
		user = eval("g_json.lines["+g_noline+"]."+select_user);
	//---- get userid ----------
	var url = serverBCK_API+"/users/user/username/"+user;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			var user_id = data;
			//---- get usergroupid ----------
			var groupid = "";
			var url = serverBCK_API+"/usersgroups";
			$.ajax({
				async : false,
				type : "GET",
				contentType: "text/html",
				dataType : "text",
				url : url,
				success : function(data) {
					var groups = $("group",data);
					for (var k=0;k<groups.length;k++){
						if ($('label',groups[k]).text()==usergroup)
							groupid = $(groups[k]).attr("id");
					}
					if (groupid=="")
						$("#batch-log").append("<br>- <span class='danger'>ERROR 1</span> in JoinUserGroup - usergroup:"+usergroup+" NOT FOUND - user:"+user);
					else {
						//---- join group --------------
						$.ajax({
							async : false,
							type : 'PUT',
							dataType : "text",
							url : serverBCK_API+"/usersgroups?group=" + groupid + "&user=" + user_id,
							data : "",
							success : function(data) {
								ok = true;
								$("#batch-log").append("<br>- JoinUserGroup - usergroup:"+usergroup+" - user:"+user);
							},
							error : function(data) {
								$("#batch-log").append("<br>- <span class='danger'>ERROR 2</span> in JoinUserGroup - usergroup:"+usergroup+" - user:"+user);
							}
						});
					}
				},
				error : function(data) {
					$("#batch-log").append("<br>- <span class='danger'>ERROR 3</span> in JoinUserGroup - usergroup:"+usergroup+" - user:"+user);
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR 4</span> in JoinUserGroup - usergroup:"+usergroup+" - user:"+user+" NOT FOUND");
		}
	});
	return ok;
}

//=================================================
g_actions['leave-usergroup'] = function LeaveUserGroup(node)
//=================================================
{
	var ok = false;
	var user = "";
	var usergroup = getTxtvals($("usergroup",node));
	var select_user = $("user>txtval",node).attr("select");
	if(typeof(select_user)=='undefined')
		user = $("user>txtval",node).text();
	else
		user = eval("g_json.lines["+g_noline+"]."+select_user);
	//---- get userid ----------
	var url = serverBCK_API+"/users/user/username/"+user;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			var user_id = data;
			//---- get usergroupid ----------
			var groupid = "";
			var url = serverBCK_API+"/usersgroups";
			$.ajax({
				async : false,
				type : "GET",
				contentType: "text/html",
				dataType : "text",
				url : url,
				success : function(data) {
					var groups = $("group",data);
					for (var k=0;k<groups.length;k++){
						if ($('label',groups[k]).text()==usergroup)
							groupid = $(groups[k]).attr("id");
					}
					if (groupid=="")
						$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in LeaveUserGroup - usergroup:"+usergroup+" NOT FOUND - user:"+user);
					else {
						//---- leave group --------------
						$.ajax({
							async : false,
							type : 'DELETE',
							dataType : "text",
							url : serverBCK_API+"/usersgroups?group=" + groupid + "&user=" + user_id,
							data : "",
							success : function(data) {
								ok = true;
								$("#batch-log").append("<br>- LeaveUserGroup - usergroup:"+usergroup+" - user:"+user);
							},
							error : function(data) {
								$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in LeaveUserGroup - usergroup:"+usergroup+" - user:"+user);
							}
						});
					}
				},
				error : function(data) {
					$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in LeaveUserGroup - usergroup:"+usergroup+" - user:"+user);
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in LeaveUserGroup - usergroup:"+usergroup+" - user:"+user+" NOT FOUND");
		}
	});
	return ok;
}

//=================================================
g_actions['delete-usergroup'] = function DeleteUserGroup(node)
//=================================================
{
}

//=================================================
g_actions['create-usergroup-by-id'] = function DeleteUserGroupById(node)
//=================================================
{
	var ok = false;
	var usergroup = getTxtvals($("usergroup",node));
	var url = serverBCK_API+"/usersgroups?group="+usergroup;
	$.ajax({
		async : false,
		type : "DELETE",
		contentType: "application/xml; charset=UTF-8",
		dataType : "text",
		url : url,
		success : function(data) {
			ok = true;
			var usergroupid = data;
			get_list_usergroups();
			$("#batch-log").append("<br>- usergroup delete - id:"+usergroup);
		},
		error : function(data) {
			$("#batch-log").append("<br>- *** not exist - id:"+usergroup);
		}
	});
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ Delete Tree ----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['delete-tree'] = function deleteTree(node)
//=================================================
{
	var ok = false;
	var treeref = $(node).attr("select");
	try {
		var portfolioid = g_trees[treeref][0];
		if (portfolioid!=undefined) {
			var url = serverBCK_API+"/portfolios/portfolio/" + portfolioid;
			$.ajax({
				async : false,
				type : "DELETE",
				contentType: "application/xml",
				dataType : "xml",
				url : url,
				data : "",
				success : function(data) {
					ok = true;
					$("#batch-log").append("<br>- tree deleted - portfolioid:"+portfolioid);
				},
				error : function(jqxhr,textStatus) {
					$("#batch-log").append("<br>- ***<span class='danger'>ERROR 1</span> delete tree - portfolioid:"+portfolioid+" ---- NOT FOUND ----");
				}
			});
		} else {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR 2</span> delete tree - portfolioid:"+portfolioid+" ---- NOT FOUND ----");
		}	
	}
	catch(err) {
		$("#batch-log").append("<br>- ***<span class='danger'>ERROR 3</span> delete tree - portfolioid:"+portfolioid+" ---- NOT FOUND ----");
	}
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ Refresh Tree URL2Units -----------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['refresh-tree-url2unit'] = function refreshTreeURL2Unit(node)
//=================================================
{
	var ok = false;
	var treeref = $(node).attr("select");
	try {
		var portfolioid = g_trees[treeref][0];
		if (portfolioid!=undefined) {
			UIFactory.URL2Unit.bringUpToDate(portfolioid);
			ok = true;
			$("#batch-log").append("<br>- tree-url2unit refreshed - portfolioid:"+portfolioid);
		} else {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> tree-url2unit - portfolioid:"+portfolioid+" ---- NOT FOUND ----");
		}	
	}
	catch(err) {
		$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> tree-url2unit refreshed -portfolioid:"+portfolioid+" ---- NOT FOUND ----");
	}
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ Refresh Tree URL2Portfolios -----------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['refresh-tree-url2portfolio'] = function refreshTreeURL2Portfolio(node)
//=================================================
{
	var ok = false;
	var treeref = $(node).attr("select");
	try {
		var portfolioid = g_trees[treeref][0];
		if (portfolioid!=undefined) {
			UIFactory.URL2Portfolio.bringUpToDate(portfolioid);
			ok = true;
			$("#batch-log").append("<br>- tree-url2portfolio refreshed - portfolioid:"+portfolioid);
		} else {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> tree-url2portfolio - portfolioid:"+portfolioid+" ---- NOT FOUND ----");
		}	
	}
	catch(err) {
		$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> tree-url2portfolio refreshed -portfolioid:"+portfolioid+" ---- NOT FOUND ----");
	}
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//-------------------------- Create Tree --------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['create-tree'] = function createTree(node)
//=================================================
{
	var ok = false;
	var code = getvarvals($("code",node));
	if (code=="")
		code = getTxtvals($("code",node));
	var treeref = $(node).attr('id');
	if (code!="") {
		var url = serverBCK_API+"/portfolios/portfolio/code/" + code;
		$.ajax({
			async : false,
			type : "GET",
			dataType : "xml",
			url : url,
			code : code,
			success : function(data) {
				$("#batch-log").append("<br>- tree already created - code:"+code);
				var result = $("portfolio", data);
				portfolioid = $(result).attr('id');
				var portfolio = new Array();
				portfolio [0] = portfolioid;
				portfolio [1] = code;
				g_trees[treeref] = portfolio;
			},
			error : function(data) {
				var label = getvarvals($("label",node));
				if (label=="")
					label = getTxtvals($("label",node));
				var template = getTxtvals($("template",node));
				//----- create tree from template -----
				var portfolioid = "";
				var url = serverBCK_API+"/portfolios/instanciate/null?sourcecode="+template+"&targetcode="+code+"&owner=true";
				$.ajax({
					async : false,
					type : "POST",
					contentType: "application/xml",
					dataType : "text",
					url : url,
					data : "",
					success : function(data) {
						portfolioid = data;
						var portfolio = new Array();
						portfolio [0] = portfolioid;
						portfolio [1] = code;
						g_trees[treeref] = portfolio;
						//----- update tree label -----
						if (code!="" && label!="") {
							$.ajax({
								async : false,
								type : "GET",
								dataType : "xml",
								url : serverBCK_API+"/nodes?portfoliocode=" + code + "&semtag=root",
								success : function(data) {
									var nodeid = $("asmRoot",data).attr('id');
									var xml = "<asmResource xsi_type='nodeRes'>";
									xml += "<code>"+code+"</code>";
									for (var lan=0; lan<languages.length;lan++)
										xml += "<label lang='"+languages[lan]+"'>"+label+"</label>";
									xml += "</asmResource>";
									$.ajax({
										async : false,
										type : "PUT",
										contentType: "application/xml",
										dataType : "text",
										data : xml,
										url : serverBCK_API+"/nodes/node/" + nodeid + "/noderesource",
										success : function(data) {
											ok = true;
											$("#batch-log").append("<br>- tree created ("+portfolioid+") - code:"+code);
											ok = true;
										},
										error : function(data) {
											$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in  create tree - code:"+code);
										}
									});
								},
								error : function(data) {
									$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in  create tree - code:"+code);
								}
							});
						} else {
							$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in  create tree update root label - code:"+code);
						}
					},
					error : function(data) {
						$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in  create tree - code:"+code);
					}
				});
			}
		});
	} else {
		$("#batch-log").append("<br>-***<span class='danger'>ERROR</span> in  create tree - code is empty");
	}
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//---------------------------Select Tree --------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['select-tree'] = function selectTree(node)
//=================================================
{
	var ok = false;
	var code = getvarvals($("code",node));
	if (code=="")
		code = getTxtvals($("code",node));
	//----- get tree id -----
	var portfolioid = UIFactory["Portfolio"].getid_bycode(code,false); 
	if (portfolioid!=""){
		ok = true;
		var portfolio = new Array();
		portfolio [0] = portfolioid;
		portfolio [1] = code;
		var treeref = $(node).attr('id');
		g_trees[treeref] = portfolio;
		$("#batch-log").append("<br>- tree selected -  - code:"+code+" - portfolioid:"+portfolioid);
	}
	else {
		$("#batch-log").append("<br> **** tree does not exist  - code:"+code);
	}
	return ok;
}


//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Copy Tree -----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['copy-tree'] = function copyTree(node)
//=================================================
{
	var ok = false;
	var code = getTxtvals($("code",node));
	var label = getTxtvals($("label",node));
	var template = getTxtvals($("template",node));
	$("#batch-log").append("<br>copy-tree template:|"+template+"| code:|"+code+"| label:|"+label+"|");
	//----- create tree from template -----
	var portfolioid = "";
	portfolioid = UIFactory["Portfolio"].copy_bycode(template,code);
	//----- update tree label -----
	if (code!="" && label!="")
		$.ajax({
			async : false,
			type : "GET",
			dataType : "xml",
			url : serverBCK_API+"/nodes?portfoliocode=" + code + "&semtag=root",
			success : function(data) {
				var nodeid = $("asmRoot",data).attr('id');
				var xml = "<asmResource xsi_type='nodeRes'>";
				xml += "<code>"+code+"</code>";
				xml += "<label lang='"+LANG+"'>"+label+"</label>";
				xml += "</asmResource>";
				$.ajax({
					async : false,
					type : "PUT",
					contentType: "application/xml",
					dataType : "text",
					data : xml,
					url : serverBCK_API+"/nodes/node/" + nodeid + "/noderesource",
					success : function(data) {
						ok = true;
						treeid = data;
						$("#batch-log").append("<br>- copy-tree created ("+treeid+") - code:"+code);
					},
					error : function(data) {
						$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in  copy-tree - code:"+code);
					}
				});
			},
			error : function(data) {
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in  copy-tree - code:"+code);
			}
		});
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ Update Tree Root -----------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['update-tree-root'] = function updateTreeRoot(node)
//=================================================
{
	var ok = false;
	var treeref = $(node).attr("select");
	var newcode = getTxtvals($("newcode",node));
	var label = getTxtvals($("label",node));
	if (newcode!="") {
		$.ajax({
			async : false,
			type : "GET",
			dataType : "xml",
			url : serverBCK_API+"/nodes?portfoliocode=" + g_trees[treeref][1] + "&semtag=root",
			success : function(data) {
				var nodeid = $("asmRoot",data).attr('id');
				var oldcode = $("code",$("asmRoot>asmResource[xsi_type='nodeRes']",data)).text();
				if (oldcode.indexOf(".")>=0) {
					//--------------  if not folder -------------
					var xml = "<asmResource xsi_type='nodeRes'>";
					xml += "<code>"+newcode+"</code>";
					for (var lan=0; lan<languages.length;lan++)
						if (lan==LANGCODE && label!="")
							xml += "<label lang='"+languages[lan]+"'>"+label+"</label>";
						else
							xml += "<label lang='"+languages[lan]+"'>"+$("label[lang='"+languages[lan]+"']",$("asmResource[xsi_type='nodeRes']",data)).text()+"</label>";
					xml += "</asmResource>";
					$.ajax({
						async : false,
						type : "PUT",
						contentType: "application/xml",
						dataType : "text",
						data : xml,
						url : serverBCK_API+"/nodes/node/" + nodeid + "/noderesource",
						success : function(data) {
							ok = true;
							$("#batch-log").append("<br>- tree root updated ("+g_trees[treeref][1]+") - newcode:"+newcode);
								//------------------
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in  updateTreeRoot - code:"+g_trees[treeref][1]+" not found");
						}
					});
				} else {
					//--------------  if folder -------------
					$.ajax({
						async: false,
						folder : this,
						type : "GET",
						dataType : "xml",
						url : serverBCK_API+"/portfolios?active=1&project="+oldcode,
						success : function(data) {
							var items = $("portfolio",data);
							for ( var i = 0; i < items.length; i++) {
								var portfolio_rootid = $("asmRoot",items[i]).attr("id");
								var portfolio_code = $("code",$("asmRoot>asmResource[xsi_type='nodeRes']",items[i])).text();
								var newportfolio_code = portfolio_code.replace(oldcode,newcode);
								var xml = "";
								xml +="<asmResource xsi_type='nodeRes'>";
								xml +="<code>"+newportfolio_code+"</code>";
								for (var j=0; j<languages.length;j++){
								if (newportfolio_code==newcode && j==LANGCODE && label!="")
									xml += "<label lang='"+languages[j]+"'>"+label+"</label>";
								else
									xml +=" <label lang='"+languages[j]+"'>"+ $("label[lang='"+languages[j]+"']",$("asmRoot>asmResource[xsi_type='nodeRes']",items[i])[0]).text()+"</label>";	
								}
								xml +="</asmResource>";
								strippeddata = xml.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
								UICom.query("PUT",serverBCK_API+'/nodes/node/'+portfolio_rootid+'/noderesource',null,"text",strippeddata);
								$("#batch-log").append("<br>- tree root updated - newcode:"+newportfolio_code);
							}
						},
						error : function(jqxhr,textStatus) {
							alertHTML("Server Error rename: "+textStatus);
						}
					});
				}
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in  updateTreeRoot - code:"+g_trees[treeref][1]);
			}
		});
	} else {
		$("#batch-log").append("<br>-***<span class='danger'>ERROR</span> in updateTreeRoot - newcode is empty");
	}
	return ok;
}


//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Share Tree ----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['share-tree'] = function shareTree(node)
//=================================================
{
	var ok = false;
	var role = "";
	var user = "";
	var treeref = $(node).attr("select");
	var role = getTxtvals($("role",node));
	var user = getTxtvals($("user",node));
	//---- get userid ----------
	var url = serverBCK_API+"/users/user/username/"+user;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			var user_id = data;
			var xml = "<users><user id='"+data+"'/></users>";
			//---- get role groupid ----------
			var groupid = "";
			var url = serverBCK_API+"/rolerightsgroups?portfolio="+g_trees[treeref][0]+"&role="+role;
			$.ajax({
				async : false,
				type : "GET",
				contentType: "text/html",
				dataType : "text",
				url : url,
				success : function(data) {
					groupid = data;
					//---- share tree --------------
					var url = serverBCK_API+"/rolerightsgroups/rolerightsgroup/" + groupid + "/users";
					$.ajax({
						async : false,
						type : "POST",
						contentType: "application/xml",
						dataType : "xml",
						url : url,
						data : xml,
						success : function(data) {
							ok = true;
							$("#batch-log").append("<br>- tree shared ("+g_trees[treeref][1]+") - user:"+user_id+" - role:"+role);
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in share tree ("+g_trees[treeref][1]+") - role:"+role);
						}
					});
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in share tree ("+g_trees[treeref][1]+") - role:"+role);
		}
	});
	return ok;
}

//=================================================
g_actions['share-tree-byemail'] = function (node)
//=================================================
{
	var ok = false;
	var role = "";
	var user = "";
	var treeref = $(node).attr("select");
	var role = getTxtvals($("role",node));
	var email = getTxtvals($("user",node));
	//---- get userid ----------
	var url = serverBCK_API+"/users/user/username/"+user;
	var xml = "<users><user email='"+email+"'/></users>";
	//---- get role groupid ----------
	var groupid = "";
	var url = serverBCK_API+"/rolerightsgroups?portfolio="+g_trees[treeref][0]+"&role="+role;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "text/html",
		dataType : "text",
		url : url,
		success : function(data) {
			groupid = data;
			//---- share tree --------------
			var url = serverBCK_API+"/rolerightsgroups/rolerightsgroup/" + groupid + "/users";
			$.ajax({
				async : false,
				type : "POST",
				contentType: "application/xml",
				dataType : "xml",
				url : url,
				data : xml,
				success : function(data) {
					ok = true;
					$("#batch-log").append("<br>- tree shared ("+g_trees[treeref][1]+") - user:"+user_id+" - role:"+role);
				},
				error : function(data) {
					$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in share tree ("+g_trees[treeref][1]+") - role:"+role);
				}
			});
		}
	});
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Set Owner Tree ----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['set-owner'] = function setOwner(node)
//=================================================
{
	var ok = false;
	var user = "";
	var treeref = $(node).attr("select");
	var user = getTxtvals($("user",node));
	//---- get userid ----------
	var url = serverBCK_API+"/users/user/username/"+user;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			var userid = data;
			//---- set owner --------------
			var url = serverBCK_API+"/portfolios/portfolio/" + g_trees[treeref][0] + "/setOwner/" + userid;
			$.ajax({
				async : false,
				type : "PUT",
				dataType : "text",
				url : url,
				success : function(data) {
					ok = true;
					$("#batch-log").append("<br>- tree owner changed ("+g_trees[treeref][1]+") - user:"+user);
				},
				error : function(data) {
					$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> tree owner changed ("+g_trees[treeref][1]+") - user:"+user);
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> tree owner changed ("+g_trees[treeref][1]+") - user:"+user);
		}
	});
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Re-Instantiate ------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['re-instantiate-tree'] = function reInstantiateTree(node)
//=================================================
{
	var ok = false;
	var treeref = $(node).attr("select");
	var url = serverBCK_API+"/portfolios/portfolio/" + g_trees[treeref][0] + "/parserights";
	$.ajax({
		async : false,
		type : "POST",
		dataType : "text",
		url : url,
		success : function(data) {
			ok = true;
			$("#batch-log").append("<br>- tree re-instantiated ("+g_trees[treeref][1]+")");
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in tree re-instantiated ("+g_trees[treeref][1]+")");
		}
	});
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Unshare Tree ----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['unshare-tree'] = function unshareTree(node)
//=================================================
{
	var ok = false;
	var role = "";
	var user = "";
	var treeref = $(node).attr("select");
	var role = getTxtvals($("role",node));
	var user = getTxtvals($("user",node));
	//---- get userid ----------
	var url = serverBCK_API+"/users/user/username/"+user;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			var user_id = data;
			//---- get role groupid ----------
			var groupid = "";
			var url = serverBCK_API+"/rolerightsgroups?portfolio="+g_trees[treeref][0]+"&role="+role;
			$.ajax({
				async : false,
				type : "GET",
				contentType: "text/html",
				dataType : "text",
				url : url,
				success : function(data) {
					groupid = data;
					//---- unshare tree --------------
					var url = serverBCK_API+"/rolerightsgroups/rolerightsgroup/" + groupid + "/users/user/"+user_id;
					$.ajax({
						async : false,
						type : "DELETE",
						contentType: "application/xml",
						dataType : "xml",
						url : url,
						data : "",
						success : function(data) {
							ok = true;
							$("#batch-log").append("<br>- tree unshared ("+g_trees[treeref][1]+") - user:"+user_id+" - role:"+role);
						},
						error : function(data) {
							$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in unshare tree ("+g_trees[treeref][1]+") - role:"+role);
						}
					});
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in unshare tree ("+g_trees[treeref][1]+") - role:"+role);
		}
	});
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ Update Resource ------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['update-resource'] = function updateResource(node)
//=================================================
{
	var ok = 0;
	var type = $(node).attr("type");
	var attributes = $("attribute",node)
	var semtag = getSemtag(node);
	//----------Test --------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceBatchVariable(test);
		test=getTest(test);
	}
	var filter_semtag = $(node).attr("filter-semtag");
	var filter_test = $(node).attr("filter-test");
	if (filter_test!=undefined) {
		filter_test = replaceBatchVariable(filter_test);
		filter_test=getTest(filter_test);
	}
	//------------ Target --------------------
	var url = getTargetUrl(node);
	//--------------------------------
	var temp_nodes = new Array();
	var temp1_nodes = new Array();
	var nodes = new Array();
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				temp_nodes[0] = results[0];
			} else {							// get by code and semtag
				temp_nodes = $("node",data);
			}
			if (test!=undefined)
				temp_nodes = eval("$(temp_nodes)"+test);
			//-------------------
			if (filter_semtag!=undefined && filter_semtag!="") {
				for (let i=0;i<temp_nodes.length;i++){
					var nodeid = $(temp_nodes[i]).attr('id');
					$.ajax({
						async : false,
						type : "GET",
						dataType : "xml",
						url : serverBCK_API+"/nodes/node/"+nodeid,
						success : function(data) {
							var nds = $("*:has(>metadata[semantictag="+filter_semtag+"])",data);
							if (filter_test!=undefined && filter_test!="")
								nds = eval("$(nds)"+filter_test);
							temp1_nodes = temp1_nodes.concat(nds);
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - update-resource "+type+"</span>");
						}
					});
				}
				nodes = temp1_nodes;
			} else {
				nodes = temp_nodes;
			}
			//-------------------
			if (nodes.length>0){
				for (var i=0; i<nodes.length; i++){
					//-------------------
					var nodeid = $(nodes[i]).attr('id');
					var resource = $("asmResource[xsi_type='"+type+"']",nodes[i]);
					for (var j=0; j<attributes.length; j++){
						var attribute_name = $(attributes[j]).attr("name");
						var language_dependent = $(attributes[j]).attr("language-dependent");
						var replace_variable = $(attributes[j]).attr("replace-variable");
						var attribute_value = "";
						if (replace_variable=='Y')
							attribute_value = getTxtvals($("attribute[name='"+attribute_name+"']",node));
						else
							attribute_value = getTxtvalsWithoutReplacement($("attribute[name='"+attribute_name+"']",node));
						if (language_dependent=='Y')
							$(attribute_name+"[lang='"+LANG+"']",resource).text(attribute_value);
						else
							$(attribute_name,resource).text(attribute_value);
					}
					var data = "<asmResource xsi_type='"+type+"'>" + $(resource).html() + "</asmResource>";
					var strippeddata = data.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
					//-------------------
					$.ajax({
						async : false,
						type : "PUT",
						contentType: "application/xml",
						dataType : "text",
						data : strippeddata,
						url : serverBCK_API+"/resources/resource/" + nodeid,
						success : function(data) {
							ok++;
							$("#batch-log").append("<br>- resource updated "+type+" - "+semtag+" - "+attribute_value);
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update resource "+type+" - "+semtag+":"+attribute_value);
						}
					});
					//-------------------
				}
			} else {
				$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - update-resource "+type+"</span>");
			}
		},
		error : function(data) {
				$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - update-resource "+type+"</span>");
		}
	});
	return (ok!=0 && ok == nodes.length);
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ Update Node Resource -------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['update-node-resource'] = function updateResource(node)
//=================================================
{
	var ok = 0;
	var type = $(node).attr("type");
	//----------Test --------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceBatchVariable(test);
		test=getTest(test);
	}
	var filter_semtag = $(node).attr("filter-semtag");
	var filter_test = $(node).attr("filter-test");
	if (filter_test!=undefined) {
		filter_test = replaceBatchVariable(filter_test);
		filter_test=getTest(filter_test);
	}
	//------------ Target --------------------
	var url = getTargetUrl(node);
	//--------------------------------
	var nodes = new Array();
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				nodes[0] = results[0];
			} else {							// get by code and semtag
				nodes = $("node",data);
			}
			nodes = eval("$(nodes)"+test);
			if (nodes.length>0){
				for (var i=0; i<nodes.length; i++){
					//-------------------
					var nodeid = $(nodes[i]).attr('id');
					var resource = $("asmResource[xsi_type='nodeRes']",nodes[i]);
					var oldcode = $("code",resource).text();
					var oldlabel =$("label[lang='"+LANG+"']",resource).text();
					var code = getTxtvals($("newcode",node));
					if (code.indexOf("##oldcode##")>-1)
						code = code.replaceAll("##oldcode##",oldcode);
					if (code.indexOf('function(')>-1) {
						var fct = code.substring(9,code.indexOf(','))
						code = code.substring(code.indexOf(',')+1,code.indexOf(')'));
						code = eval(fct+"('"+code+"')");
					}
					var label = getTxtvals($("label",node));
					if (label.indexOf("##oldlabel##")>-1)
						label = label.replaceAll("##oldlabel##",oldlabel);
					//--------------------------------
					if (code!="")
						$("code",resource).text(code);
					if (label!="")
						$("label[lang='"+LANG+"']",resource).text(label);
					var data = "<asmResource xsi_type='nodeRes'>" + $(resource).html() + "</asmResource>";
					var strippeddata = data.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
					//-------------------
					$.ajax({
						async : false,
						type : "PUT",
						contentType: "application/xml",
						dataType : "text",
						data : strippeddata,
						url : serverBCK_API+"/nodes/node/" + nodeid + "/noderesource",
						success : function(data) {
							ok++;
							$("#batch-log").append("<br>- resource updated ("+nodeid+") type : "+type);
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update resource("+nodeid+" type : "+type);
						}
					});
					//-------------------
				}
			} else {
				$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - update-node-resource - type: "+type+"</span>");
			}
		},
		error : function(data) {
				$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - update-node-resource - type: "+type+"</span>");
		}
	});
	return (ok!=0 && ok == nodes.length);
}


//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------- Update Node - Metadata ----------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['update-node'] = function updateNode(node)
//=================================================
{
	var ok = false;
	var select = $(node).attr("select");
	var type = $(node).attr("type");
	var idx = select.indexOf(".");
	//----------Test --------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceVariable(test);
		test=getTest(test);
	}
	var filter_semtag = $(node).attr("filter-semtag");
	var filter_test = $(node).attr("filter-test");
	if (filter_test!=undefined) {
		filter_test = replaceVariable(filter_test);
		filter_test=getTest(filter_test);
	}
	//----------------------------------------------------
	if (select=='#current_node') {
		$.ajax({
			async : false,
			type : "GET",
			dataType : "xml",
			url : serverBCK_API+"/nodes/node/"+g_current_node_uuid,
			success : function(data) {
				ok = true;
				var results = $('*',data);
				var nodes = new Array();
				nodes[0] = results[0];
				var text = getTxtvals($("text",node));
				if ($("source",node).length>0){
					var source_select = $("source",node).attr("select");
					var source_idx = source_select.indexOf(".");
					var source_treeref = source_select.substring(0,source_idx);
					var source_semtag = source_select.substring(source_idx+1);
					if (source_semtag=="UUID")
						text = g_trees[source_treeref][0];
				}
				//---------------------------
				if (type=='Metadata'){
					var attribute = $(node).attr("attribute");
					updateMetada(nodes,node,type,semtag,text,attribute)
				}
				if (type=='Metadatawad'){
					var attribute = $(node).attr("attribute");
					updateMetadawad(nodes,node,type,semtag,text,attribute)
				}
				if (type=='Metadataepm'){
					var attribute = $(node).attr("attribute");
					updateMetadaepm(nodes,node,type,semtag,text,attribute)
				}
				if (type=='Field') {//---------------------- for backward compatibility ---------------------
					updateField(nodes,node,type,semtag,text);
				}
				if (type=='Proxy') {//---------------------- for backward compatibility ---------------------
					updateProxy(nodes,node,type,semtag);
				}
				if (type=='Dashboard') {//---------------------- for backward compatibility ---------------------
					updateDashboard(nodes,node,type,semtag,text);
				}
				if (type=='MetadataInline'){//---------------------- for backward compatibility ---------------------
					var attribute = 'inline';
					updateMetada(nodes,node,type,semtag,text,attribute)
				}
				if (type=='MetadatawadQuery') {//---------------------- for backward compatibility ---------------------
					var attribute = 'query';
					updateMetadawad(nodes,node,type,semtag,text,attribute);
				}
				if (type=='MetadatawadMenu') {//---------------------- for backward compatibility ---------------------
					var attribute = 'menuroles';
					updateMetadawad(nodes,node,type,semtag,text,attribute);
				}
				if (type=='NodeResource') {//---------------------- for backward compatibility ---------------------
					updateNodeResource(nodes,node);
				}
				if (type=='Calendar') {//---------------------- for backward compatibility ---------------------
					updateCalendar(nodes,node,text,semtag);
				}
				if (type=='Document') {//---------------------- for backward compatibility ---------------------
					updateDocument(nodes,node,text,semtag);
				}
				if (type=='Rights'){//---------------------- for backward compatibility ---------------------
					var rd = $(node).attr("rd");
					var wr = $(node).attr("wr");
					var dl = $(node).attr("dl");
					var sb = $(node).attr("sb");
					updateRights(nodes,node,role,rd,wr,dl,sb);
				}
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR</span> in update-resource - uuid="+g_current_node_uuid+" semtag="+semtag);
			}
		});
	} else {
		var treeref = select.substring(0,idx);
		var semtag = select.substring(idx+1);
		$.ajax({
			async : false,
			type : "GET",
			dataType : "xml",
			url : serverBCK_API+"/nodes?portfoliocode=" + g_trees[treeref][1] + "&semtag="+semtag,
			success : function(data) {
				var nodes = $("node",data);
				nodes = eval("$(nodes)"+test);
				var text = getTxtvals($("text",node));
				$("#batch-log").append("<br>- " + nodes.length + " nodes");
				if (nodes.length>0) {
					ok = true;
					if ($("source",node).length>0){
						var source_select = $("source",node).attr("select");
						var source_idx = source_select.indexOf(".");
						var source_treeref = source_select.substring(0,source_idx);
						var source_semtag = source_select.substring(source_idx+1);
						if (source_semtag=="UUID")
							text = g_trees[source_treeref][0];
					}
					//---------------------------
					if (type=='Metadata'){
						var attribute = $(node).attr("attribute");
						updateMetada(nodes,node,type,semtag,text,attribute)
					}
					if (type=='Metadatawad'){
						var attribute = $(node).attr("attribute");
						updateMetadawad(nodes,node,type,semtag,text,attribute)
					}
					if (type=='Metadataepm'){
						var attribute = $(node).attr("attribute");
						updateMetadaepm(nodes,node,type,semtag,text,attribute)
					}
					if (type=='Field') {//---------------------- for backward compatibility ---------------------
						updateField(nodes,node,type,semtag,text);
					}
					if (type=='Proxy') {//---------------------- for backward compatibility ---------------------
						updateProxy(nodes,node,type,semtag);
					}
					if (type=='Dashboard') {//---------------------- for backward compatibility ---------------------
						updateDashboard(nodes,node,type,semtag,text);
					}
					if (type=='MetadataInline'){//---------------------- for backward compatibility ---------------------
						var attribute = 'inline';
						updateMetada(nodes,node,type,semtag,text,attribute)
					}
					if (type=='MetadatawadQuery') {//---------------------- for backward compatibility ---------------------
						var attribute = 'query';
						updateMetadawad(nodes,node,type,semtag,text,attribute);
					}
					if (type=='MetadatawadMenu') {//---------------------- for backward compatibility ---------------------
						var attribute = 'menuroles';
						updateMetadawad(nodes,node,type,semtag,text,attribute);
					}
					if (type=='NodeResource') {//---------------------- for backward compatibility ---------------------
						updateNodeResource(nodes,node);
					}
					if (type=='Calendar') {//---------------------- for backward compatibility ---------------------
						updateCalendar(nodes,node,text,semtag);
					}
					if (type=='Document') {//---------------------- for backward compatibility ---------------------
						updateDocument(nodes,node,text,semtag);
					}
					if (type=='Rights'){//---------------------- for backward compatibility ---------------------
						var rd = $(node).attr("rd");
						var wr = $(node).attr("wr");
						var dl = $(node).attr("dl");
						var sb = $(node).attr("sb");
						updateRights(nodes,node,role,rd,wr,dl,sb);
					}
				} else {
					$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR</span> in update-resource - tree="+g_trees[treeref][1]+" semtag="+semtag+" type="+type+" value="+text);
				}
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR</span> in update-resource - tree="+g_trees[treeref][1]+" semtag="+semtag+" type="+type+" value="+text);
			}
		});
	}
	return ok;
}


//=================================================
function updateMetada(nodes,node,type,semtag,text,attribute)
//=================================================
{
	for (var inode=0;inode<nodes.length;inode++) {
		var nodeid = $(nodes[inode]).attr('id');
		var metadata = $("metadata",nodes[inode]);
		$(metadata).attr(attribute,text);
		var xml = xml2string(metadata[0]);
		$.ajax({
			async : false,
			type : "PUT",
			contentType: "application/xml",
			dataType : "text",
			data : xml,
			nodeid : nodeid,
			semtag : semtag,
			url : serverBCK_API+"/nodes/node/" + nodeid+"/metadata",
			success : function(data) {
				$("#batch-log").append("<br>- resource metadata updated ("+this.nodeid+") - semtag="+this.semtag+" attribute="+attribute+" value="+text);
			},
			error : function(data,nodeid,semtag) {
				$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update metadata("+this.nodeid+") - semtag="+this.semantictag+" attribute="+attribute+" value="+text);
			}
		});
	}
}

//=================================================
function updateMetadawad(nodes,node,type,semtag,text,attribute)
//=================================================
{
	if (attribute=="menuroles")
		text = text.replaceAll("<br/>","").replaceAll("<br>","").replaceAll("&amp;","&");
	for (var inode=0;inode<nodes.length;inode++) {
		var nodeid = $(nodes[inode]).attr('id');
		var metadatawad = $("metadata-wad",nodes[inode]);
		$(metadatawad).attr(attribute,text);
		var xml = xml2string(metadatawad[0]);
		if (attribute=="menuroles")
			xml = xml.replaceAll("&amp;","&");
		$.ajax({
			async : false,
			type : "PUT",
			contentType: "application/xml",
			dataType : "text",
			data : xml,
			nodeid : nodeid,
			semtag : semtag,
			url : serverBCK_API+"/nodes/node/" + nodeid+"/metadatawad",
			success : function(data) {
				$("#batch-log").append("<br>- resource metadatawad updated ("+this.nodeid+") - semtag="+this.semtag+" attribute="+attribute+" value="+text);
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update metadatawad("+this.nodeid+") - semtag="+this.semantictag+" attribute="+attribute+" value="+text);
			}
		});
	}
}

//=================================================
function updateMetadaepm(nodes,node,type,semtag,text,attribute)
//=================================================
{
	for (var inode=0;inode<nodes.length;inode++) {
		var nodeid = $(nodes[inode]).attr('id');
		var metadatawad = $("metadata-epm",nodes[inode]);
		$(metadatawad).attr(attribute,text);
		var xml = xml2string(metadatawad[0]);
		$.ajax({
			async : false,
			type : "PUT",
			contentType: "application/xml",
			dataType : "text",
			data : xml,
			nodeid : nodeid,
			semtag : semtag,
			url : serverBCK_API+"/nodes/node/" + nodeid+"/metadataepm",
			success : function(data) {
				$("#batch-log").append("<br>- resource metadataepm updated ("+this.nodeid+") - semtag="+this.semtag+" attribute="+attribute+" value="+text);
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update metadataepm("+this.nodeid+") - semtag="+this.semantictag+" attribute="+attribute+" value="+text);
			}
		});
	}
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ Update Rights ------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['update-rights'] = function updateRights(node)
//=================================================
{
	var ok = 0;
	var role = $(node).attr("role");
	var rd = $(node).attr("rd");
	var wr = $(node).attr("wr");
	var dl = $(node).attr("dl");
	var sb = $(node).attr("sb");
	var select = $(node).attr("select");
	var idx = select.lastIndexOf(".");
	var treeref = select.substring(0,idx);
	var semtag = select.substring(idx+1);
	//----------Test --------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceVariable(test);
		test=getTest(test);
	}
	var filter_semtag = $(node).attr("filter-semtag");
	var filter_test = $(node).attr("filter-test");
	if (filter_test!=undefined) {
		filter_test = replaceVariable(filter_test);
		filter_test=getTest(filter_test);
	}
	//------------ Target --------------------
	var url = getTargetUrl(node);
	//--------------------------------
	var nodes = new Array();
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				nodes[0] = results[0];
			} else {							// get by code and semtag
				nodes = $("node",data);
			}
			if (nodes.length>0){
				for (var i=0; i<nodes.length; i++){
					//-------------------
					var nodeid = $(nodes[i]).attr('id');
					var xml = "<node><role name='"+role+"'><right RD='"+rd+"' WR='"+wr+"' DL='"+dl+"' SB='"+sb+"'></right></role></node>"
//					nodes = nodes.slice(1,nodes.length);
					$.ajax({
						async : false,
						type : "POST",
						contentType: "application/xml",
						dataType : "text",
						data : xml,
						nodeid : nodeid,
						semtag : semtag,
						url : serverBCK_API+"/nodes/node/" + nodeid +"/rights",
						success : function(data) {
							ok++;
							$("#batch-log").append("<br>- resource rights updated ("+this.nodeid+") - RD="+rd+" WR="+wr+" DL="+dl+" SB="+sb);
						},
						error : function(data,nodeid,semtag) {
							$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> resource rights updated ("+this.nodeid+") - RD="+rd+" WR="+wr+" DL="+dl+" SB="+sb);
						}
					});
				}
			} else {
				$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR</span> in update rights("+nodeid+") - semtag="+semtag);
			}
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update rights("+nodeid+") - semtag="+semtag);
		}
	});
	return (ok!=0 && ok == nodes.length);
}


//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//--------------------------- -byid -------------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['update-field-byid'] = function updateFieldById(node)
//=================================================
{
	var ok = false;
	var text = getTxtvals($("text",node));
	var nodeid = getTxtvals($("uuid",node));
	var xml = "<asmResource xsi_type='Field'>";
	xml += "<text lang='"+LANG+"'>"+text+"</text>";
	xml += "</asmResource>";
	$.ajax({
		async : false,
		type : "PUT",
		contentType: "application/xml",
		dataType : "text",
		data : xml,
		url : serverBCK_API+"/resources/resource/" + nodeid,
		success : function(data) {
			ok = true;
			$("#batch-log").append("<br>- resource updated ("+nodeid+")");
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update resource("+nodeid+")");
		}
	});
	return ok;
}

//=================================================
g_actions['reset-document-byid'] = function resetDocumentById(node)
//=================================================
{
	var ok = false;
	var nodeid = getTxtvals($("uuid",node));
	var xml = "<asmResource xsi_type='Document'>";
	xml += "<filename lang='fr'>Aucun document</text>";
	xml += "<filename lang='en'>No Document</text>";
	xml += "<size lang='fr'></text>";
	xml += "<size lang='en'></text>";
	xml += "<type lang='fr'></text>";
	xml += "<type lang='en'></text>";
	xml += "<fileid lang='fr'></text>";
	xml += "<fileid lang='en'></text>";
	xml += "</asmResource>";
	$.ajax({
		async : false,
		type : "PUT",
		contentType: "application/xml",
		dataType : "text",
		data : xml,
		url : serverBCK_API+"/resources/resource/" + nodeid +"?delfile=true",
		success : function(data) {
			ok = true;
			$("#batch-log").append("<br>- document reset ("+nodeid+")");
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in reset document("+nodeid+")");
		}
	});
	return ok;
}

//=================================================
g_actions['delete-node-byid'] = function deleteNodeById(node)
//=================================================
{
	var ok = false;
	var nodeid = getTxtvals($("uuid",node));
	$.ajax({
		async : false,
		type : "DELETE",
		dataType : "text",
		url : serverBCK_API+"/nodes/node/" + nodeid,
		data : "",
		success : function(data) {
			ok = true;
			$("#batch-log").append("<br>- node deleted ("+nodeid+")");
		},
		error : function(data) {
			$("#batch-log").append("<br>- *** <span class='danger'>ERROR</span> in deleting node : "+nodeid);
		}
	});
	return ok;
}

//=================================================
g_actions['delete-tree-byid'] = function (node)
//=================================================
{
	var ok = false;
	var portfolioid = getTxtvals($("uuid",node));
	$.ajax({
		async : false,
		type : "DELETE",
		dataType : "text",
		url : serverBCK_API+"/portfolios/portfolio/" + portfolioid,
		data : "",
		success : function(data) {
			ok = true;
			$("#batch-log").append("<br>- tree deleted ("+portfolioid+")");
		},
		error : function(data) {
			$("#batch-log").append("<br>- *** <span class='danger'>ERROR</span> in deleting tree : "+portfolioid);
		}
	});
	return ok;
}


//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//--------------------------- Portfolio Group ---------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['create-portfoliogroup'] = function CreatePortfolioGroup(node)
//=================================================
{
	var ok = false;
	var portfoliogroup = getTxtvals($("portfoliogroup",node));
	var url = serverBCK_API+"/portfoliogroups?type=portfolio&label="+portfoliogroup;
	$.ajax({
		async : false,
		type : "POST",
		contentType: "application/xml; charset=UTF-8",
		dataType : "text",
		url : url,
		success : function(data) {
			ok = true;
			var portfoliogroupid = data;
			get_list_portfoliosgroups();
			$("#batch-log").append("<br>- portfoliogroup created - label:"+portfoliogroup);
		},
		error : function(data) {
			$("#batch-log").append("<br>- *** already defined - label:"+portfoliogroup);
		}
	});
	return ok;
}

//=================================================
g_actions['join-portfoliogroup'] = function JoinPortfolioGroup(node)
//=================================================
{
	var ok = false;
	var portfoliogroup = getTxtvals($("portfoliogroup",node));
	var select = $(node).attr("select");  // select = #portfoliocode. or refid
	//---- get portfoliogroupid ----------
	var groupid = "";
	var url = serverBCK_API+"/portfoliogroups";
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : url,
		success : function(data) {
			var groups = $("group",data);
			for (var k=0;k<groups.length;k++){
				if ($('label',groups[k]).text()==portfoliogroup)
					groupid = $(groups[k]).attr("id");
			}
			if (groupid=="")
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in JoinPortfolioGroup - portfoliogroup:"+portfoliogroup+" NOT FOUND");
			else {
				if (select.indexOf("#")<0) {
					var treeref = select.replace(".","");
					//---- join group --------------
					$.ajax({
						async : false,
						type : 'PUT',
						dataType : "text",
						url : serverBCK_API+"/portfoliogroups?group="+groupid+"&uuid=" + g_trees[treeref][0],
						data : "",
						success : function(data) {
							ok = true;
							$("#batch-log").append("<br>- JoinPortfolioGroup - portfoliogroup:"+portfoliogroup+" - portfolio:"+g_trees[treeref][1]);
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in JoinPortfolioGroup - portfoliogroup:"+portfoliogroup+" - portfolio:"+g_trees[treeref][1]);
						}
					});
				}else if (select.length>2) {
					var url = serverBCK_API+"/portfolios?active=1&search="+select.substring(1);
					$.ajax({
						async: false,
						type : "GET",
						dataType : "xml",
						url : url,
						success : function(data) {
							var trees = $("portfolio",data);
							for (var i=0; i<trees.length; i++){
								var portfolioid = $(trees[i]).attr("id");
								//---- join group --------------
								$.ajax({
									async : false,
									type : 'PUT',
									dataType : "text",
									url : serverBCK_API+"/portfoliogroups?group="+groupid+"&uuid=" + portfolioid,
									data : "",
									success : function(data) {
										ok = true;
										$("#batch-log").append("<br>- JoinPortfolioGroup - portfoliogroup:"+portfoliogroup+" - portfolio:"+portfolioid);
									},
									error : function(data) {
										$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in JoinPortfolioGroup - portfoliogroup:"+portfoliogroup+" - portfolio:"+portfolioid);
									}
								});
							}
						}
					});

				}
			}
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in JoinPortfolioGroup - portfoliogroup:"+portfoliogroup);
		}
	});
	return ok;
}

//=================================================
g_actions['leave-portfoliogroup'] = function LeavePortfolioGroup(node)
//=================================================
{
	var ok = false;
	var portfoliogroup = getTxtvals($("portfoliogroup",node));
	var select = $(node).attr("select");
	var treeref = select.replace(".","");
	//---- get portfoliogroupid ----------
	var groupid = "";
	var url = serverBCK_API+"/portfoliogroups";
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : url,
		success : function(data) {
			var groups = $("group",data);
			for (var k=0;k<groups.length;k++){
				if ($('label',groups[k]).text()==portfoliogroup)
					groupid = $(groups[k]).attr("id");
			}
			if (groupid=="")
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in LeavePortfolioGroup - portfoliogroup : "+portfoliogroup+" NOT FOUND");
			else {
				//---- leave group --------------
				$.ajax({
					async : false,
					type : 'DELETE',
					dataType : "text",
					url : serverBCK_API+"/portfoliogroups?group="+groupid+"&uuid=" + g_trees[treeref][0],
					data : "",
					success : function(data) {
						ok = true;
						$("#batch-log").append("<br>- LeavePortfolioGroup - portfoliogroup : "+portfoliogroup+" - portfolio : "+g_trees[treeref][1]);
					},
					error : function(data) {
						$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in JoinPortfolioGroup - portfoliogroup : "+portfoliogroup+" - portfolio:"+g_trees[treeref][1]);
					}
				});
			}
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in JoinPortfolioGroup - portfoliogroup:"+portfoliogroup+" - portfolio:"+g_trees[treeref][1]);
		}
	});
	return ok;
}

//=================================================
g_actions['share-portfoliogroup'] = function sharePortfolioGroup(node)
//=================================================
{
	var ok = false;
	var user = getTxtvals($("identifier",node));;
	var role = getTxtvals($("role",node));
	var portfoliogroup = getTxtvals($("portfoliogroup",node));
	var portfoliogroupid = get_portfoliogroupid(portfoliogroup);
	var url = serverBCK_API+"/users/user/username/"+user;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			var user_id = data;
			var users = "<users><user id='"+user_id+"'/></users>";
			$.ajax({
				async : false,
				type : "GET",
				dataType : "xml",
				url : serverBCK_API+"/portfoliogroups?group="+portfoliogroupid,
				success : function(data) {
					var portfolios = $("portfolio",data);
					if (portfolios.length>0) {
						for (var i=0; i<portfolios.length;i++) {
							var portfolioid = $(portfolios[i]).attr("id");
							//---- get role groupid ----------
							var groupid = "";
							var url = serverBCK_API+"/rolerightsgroups?portfolio="+portfolioid+"&role="+role;
							$.ajax({
								async : false,
								type : "GET",
								contentType: "text/html",
								dataType : "text",
								url : url,
								success : function(data) {
									groupid = data;
									//---- share tree --------------
									var url = serverBCK_API+"/rolerightsgroups/rolerightsgroup/" + groupid + "/users";
									$.ajax({
										async : false,
										type : "POST",
										contentType: "application/xml",
										dataType : "xml",
										url : url,
										data : users,
										success : function(data) {
											ok = true;
											$("#batch-log").append("<br>* tree shared - portfoliogroup : "+portfoliogroup+" - user : "+user+" - role : "+role+" - portfolioid:"+portfolioid);
										},
										error : function(data) {
											$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in sharing tree - portfoliogroup : "+portfoliogroup+" - user : "+user+" - role : "+role+" - portfolioid : "+portfolioid);
										}
									});
								},
								error : function(data) {
									$("#batch-log").append("<br>- <span class='danger'>ERROR</span> role:"+role+" NOT FOUND - portfolioid : "+portfolioid);
								}
							});
						}
					} else {
						$("#batch-log").append("<br>- <span class='danger'>ERROR</span> - portfoliogroup : "+portfoliogroup+" is EMPTY");				
					}
				},		
				error : function(data) {
					$("#batch-log").append("<br>- <span class='danger'>ERROR</span> Portfoliogroup does not exist - portfoliogroup:"+portfoliogroup);
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR</span> user : "+user+" NOT FOUND");
		}
	});
	return ok;
}

//=================================================
g_actions['unshare-portfoliogroup'] = function unsharePortfolioGroup(node)
//=================================================
{
	var ok = false;
	var user = getTxtvals($("identifier",node));;
	var role = getTxtvals($("role",node));
	var portfoliogroup = getTxtvals($("portfoliogroup",node));
	var portfoliogroupid = get_portfoliogroupid(portfoliogroup);
	var url = serverBCK_API+"/users/user/username/"+user;
	$.ajax({
		async : false,
		type : "GET",
		contentType: "application/xml",
		dataType : "text",
		url : url,
		success : function(data) {
			var user_id = data;
			$.ajax({
				async : false,
				type : "GET",
				dataType : "xml",
				url : serverBCK_API+"/portfoliogroups?group="+portfoliogroupid,
				success : function(data) {
					var portfolios = $("portfolio",data);
					if (portfolios.length>0) {
						for (var i=0; i<portfolios.length;i++) {
							var portfolioid = $(portfolios[i]).attr("id");
							//---- get role groupid ----------
							var groupid = "";
							var url = serverBCK_API+"/rolerightsgroups?portfolio="+portfolioid+"&role="+role;
							$.ajax({
								async : false,
								type : "GET",
								contentType: "text/html",
								dataType : "text",
								url : url,
								success : function(data) {
									groupid = data;
									//---- unshare tree --------------
									var url = serverBCK_API+"/rolerightsgroups/rolerightsgroup/" + groupid + "/users/user/"+user_id;
									$.ajax({
										async : false,
										type : "DELETE",
										contentType: "application/xml",
										dataType : "xml",
										url : url,
										success : function(data) {
											ok = true;
											$("#batch-log").append("<br>* tree unshared - portfoliogroup : "+portfoliogroup+" - user : "+user+" - role : "+role+" - portfolioid:"+portfolioid);
										},
										error : function(data) {
											$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in unsharing tree - portfoliogroup : "+portfoliogroup+" - user : "+user+" - role : "+role+" - portfolioid : "+portfolioid);
										}
									});
								},
								error : function(data) {
									$("#batch-log").append("<br>- <span class='danger'>ERROR</span> role:"+role+" NOT FOUND - portfolioid : "+portfolioid);
								}
							});
						}
					} else {
						$("#batch-log").append("<br>- <span class='danger'>ERROR</span> - portfoliogroup : "+portfoliogroup+" is EMPTY");				
					}
				},		
				error : function(data) {
					$("#batch-log").append("<br>- <span class='danger'>ERROR</span> Portfoliogroup does not exist - portfoliogroup:"+portfoliogroup);
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR</span> user : "+user+" NOT FOUND");
		}
	});
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Share with UserGroup ------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['share-usergroup'] = function shareUserGroup(node)
//=================================================
{
	var ok = false;
	var role = "";
	var user = "";
	var treeref = $(node).attr("select");
	var role = getTxtvals($("role",node));
	var usergroupname = getTxtvals($("groupname",node));
	var usergroupid = get_usergroupid(usergroupname);
	
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : serverBCK_API+"/usersgroups?group="+usergroupid,
		success : function(data) {
			var users = "<users>" + $($("users",data)[0]).html() + "</users>";
			if (users.length>20) {
				//---- get role groupid ----------
				var groupid = "";
				var url = serverBCK_API+"/rolerightsgroups?portfolio="+g_trees[treeref][0]+"&role="+role;
				$.ajax({
					async : false,
					type : "GET",
					contentType: "text/html",
					dataType : "text",
					url : url,
					success : function(data) {
						groupid = data;
						//---- share tree --------------
						var url = serverBCK_API+"/rolerightsgroups/rolerightsgroup/" + groupid + "/users";
						$.ajax({
							async : false,
							type : "POST",
							contentType: "application/xml",
							dataType : "xml",
							url : url,
							data : users,
							success : function(data) {
								ok = true;
								$("#batch-log").append("<br>tree shared with usergroup  ("+g_trees[treeref][1]+") - usergroup:"+usergroupname+" - role:"+role);
							},
							error : function(data) {
								$("#batch-log").append("<br>- <span class='danger'>ERROR</span> tree shared with usergroup  ("+g_trees[treeref][1]+") - usergroup:"+usergroupname+" - role:"+role);
							}
						});
					},
					error : function(data) {
						$("#batch-log").append("<br>- <span class='danger'>ERROR</span> tree shared with usergroup  ("+g_trees[treeref][1]+") - usergroup:"+usergroupname+" - role:"+role);
					}
				});
			} else {
				$("#batch-log").append("<br><span class='danger'>ERROR</span> Empty group - tree shared with usergroup  ("+g_trees[treeref][1]+") - usergroup:"+usergroupname+" - role:"+role);
			}
		},
		error : function(data) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR</span> tree shared with usergroup  ("+g_trees[treeref][1]+") - usergroup:"+usergroupname+" - role:"+role);
		}
	});
	return ok;
}



//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Unshare with UserGroup ----------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['unshare-usergroup'] = function unshareUserGroup(node)
//=================================================
{
	var ok = false;
	var treeref = $(node).attr("select");
	var role = getTxtvals($("role",node));
	var usergroupname = getTxtvals($("groupname",node));
	var usergroupid = get_usergroupid(usergroupname);
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : serverBCK_API+"/usersgroups?group="+usergroupid,
		success : function(data) {
			var users = $("user",data);
			var groupid = "";
			var url = serverBCK_API+"/rolerightsgroups?portfolio="+g_trees[treeref][0]+"&role="+role;
			$.ajax({
				async : false,
				type : "GET",
				contentType: "text/html",
				dataType : "text",
				url : url,
				success : function(data) {
					groupid = data;
					for (var i=0; i<users.length; i++){
						var userid = $(users[i]).attr('id');
						var url = serverBCK_API+"/rolerightsgroups/rolerightsgroup/" + groupid + "/users/user/"+userid;
						$.ajax({
							async : false,
							type : "DELETE",
							contentType: "application/xml",
							dataType : "xml",
							url : url,
							data : "",
							success : function(data) {
								ok = true;
								$("#batch-log").append("<br>tree with usergroup unshared ("+g_trees[treeref][1]+") - usergroup:"+usergroupname+" - userid:"+userid+" - role:"+role);
							},
							error : function(jqxhr,textStatus) {
								$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in usergroup unshared ("+g_trees[treeref][1]+") - usergroup:"+usergroupname+" - userid:"+userid+" - role:"+role);
							}
						});
					}
				},
				error : function(data) {
					$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in usergroup unshared ("+g_trees[treeref][1]+") - usergroup:"+usergroupname+" - userid:"+userid+" - role:"+role);
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in usergroup unshared ("+g_trees[treeref][1]+") - usergroup:"+usergroupname+" - userid:"+userid+" - role:"+role);
		}
	});
	return ok;
}


//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Share Groups --------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['share-groups'] = function shareGroups(node)
//=================================================
{
	var ok = false;
	var role = getTxtvals($("role",node));
	var usergroup = getTxtvals($("usergroup",node));
	var usergroupid = get_usergroupid(usergroup);
	var portfoliogroup = getTxtvals($("portfoliogroup",node));
	var portfoliogroupid = get_portfoliogroupid(portfoliogroup);
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : serverBCK_API+"/portfoliogroups?group="+portfoliogroupid,
		success : function(data) {
			var portfolios = $("portfolio",data);
			if (portfolios.length>0) {
				$.ajax({
					async : false,
					type : "GET",
					dataType : "xml",
					url : serverBCK_API+"/usersgroups?group="+usergroupid,
					success : function(data) {
						var users = "<users>" + $($("users",data)[0]).html() + "</users>";
						if (users.length>20) {
							for (var i=0; i<portfolios.length;i++) {
								var portfolioid = $(portfolios[i]).attr("id");
								//---- get role groupid ----------
								var groupid = "";
								var url = serverBCK_API+"/rolerightsgroups?portfolio="+portfolioid+"&role="+role;
								$.ajax({
									async : false,
									type : "GET",
									contentType: "text/html",
									dataType : "text",
									url : url,
									success : function(data) {
										groupid = data;
										//---- share tree --------------
										var url = serverBCK_API+"/rolerightsgroups/rolerightsgroup/" + groupid + "/users";
										$.ajax({
											async : false,
											type : "POST",
											contentType: "application/xml",
											dataType : "xml",
											url : url,
											data : users,
											success : function(data) {
												ok = true;
												$("#batch-log").append("<br>* tree shared - portfoliogroup:"+portfoliogroup+" - usergroup:"+usergroup+" - role:"+role+" - portfolioid:"+portfolioid);
											},
											error : function(data) {
												$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in tree sharing with usergroup  - portfolioid:"+portfolioid+") - usergroup:"+usergroup+" - role:"+role);
											}
										});
									},
									error : function(data) {
										$("#batch-log").append("<br>- <span class='danger'>ERROR</span> role does not exist  - portfolioid:"+portfolioid+" - role:"+role);
									}
								});
							}
						} else {
							$("#batch-log").append("<br><span class='danger'>ERROR</span> - Usergroup is empty - usergroup:"+usergroup);
						}
					},
					error : function(data) {
						$("#batch-log").append("<br>- <span class='danger'>ERROR</span> - Usergroup does not exist -  - usergroup:"+usergroup);
					}
				});
			} else {
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span>  - Portfoliogroup is empty - portfoliogroup:"+portfoliogroup);				
			}
		},		
		error : function(data) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR</span> Portfoliogroup does not exist - portfoliogroup:"+portfoliogroup);
		}
	});
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Import Node ----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['import-node'] = function importNode(node)
//=================================================
{
	var ok = false
	//-----------------------------------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceVariable(test);
		test = replaceBatchVariable(getTest(test),node);
	}
	//------------------------------------
	var source = $("source",node).text();
	if (source=='') // for backward compatibility
		source = $(node).attr("source");
	var idx_source = source.lastIndexOf(".");
	var srcecode = source.substring(0,idx_source);
	if (srcecode.indexOf('#')>-1)
		srcecode = srcecode.substring(1);
	else
		srcecode = g_trees[srcecode][1];
	
	var srcetag = source.substring(idx_source+1);
	//------------------------------------
	var select = $(node).attr("select");
	var idx = select.lastIndexOf(".");
	var treeref = select.substring(0,idx);
	var semtag = select.substring(idx+1);
	//------------------------------------
	if (select.indexOf('#current_node')+select.indexOf('#uuid')>-2){
		if (select.indexOf('#current_node')>-1)
			destid = g_current_node_uuid;
		else
			destid = replaceVariable(b_replaceVariable(treeref)); // select = porfolio_uuid.#uuid
		var urlS = serverBCK_API+"/nodes/node/import/"+destid+"?srcetag="+srcetag+"&srcecode="+srcecode;
		$.ajax({
			async:false,
			type : "POST",
			dataType : "text",
			url : urlS,
			data : "",
			destid:destid,
			success : function(data) {
				g_current_node_uuid = data;
				$("#batch-log").append("<br>- node ("+g_current_node_uuid+") added at ("+this.destid+") - semtag="+semtag+ " source="+source);
				ok = true;
			},
			error : function(data) {
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in import node("+this.destid+") - semtag="+semtag+ " source="+source);
			}
		});
	} else {
		//------------ Target --------------------
		var url = "";
		if (treeref.indexOf("#")>-1)
			url = serverBCK_API+"/nodes?portfoliocode=" + treeref.substring(1) + "&semtag="+semtag;	
		else
			url = serverBCK_API+"/nodes?portfoliocode=" + g_trees[treeref][1] + "&semtag="+semtag;
		//--------------------------------
		$.ajax({
			async: false,
			type : "GET",
			dataType : "xml",
			url : url,
			success : function(data) {
				var nodes = $("node",data);
				if (test!=undefined)
					nodes = eval("$(nodes)"+test);
				if (nodes.length>0){
					for (var i=0; i<nodes.length; i++){
						destid = $(nodes[i]).attr('id');
						var urlS = serverBCK_API+"/nodes/node/import/"+destid+"?srcetag="+srcetag+"&srcecode="+srcecode;
						$.ajax({
							async:false,
							type : "POST",
							dataType : "text",
							url : urlS,
							data : "",
							destid:destid,
							success : function(data) {
								if (data.indexOf("llegal operation")<0) {
									ok = true;
									g_current_node_uuid = data;
									$("#batch-log").append("<br>- node ("+g_current_node_uuid+") added at ("+this.destid+") - semtag="+semtag+ " source="+source);
								} else{
									$("#batch-log").append("<br>- <span class='danger'>ERROR</span> SOURCE NOT FOUND - semtag="+semtag+ " source="+source);
								}
							},
							error : function(data) {
								$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in import node("+this.destid+") - semtag="+semtag+ " source="+source);
							}
						});
					}
				} else {
					$("#batch-log").append("<br>- <span class='danger'>ERROR</span> NOT FOUND - semtag="+semtag+ " source="+source);
				}
			},
			error : function(data) {
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in import NOT FOUND - semtag="+semtag+ " source="+source);
			}
		});
	}
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Move Node ----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['move-node'] = function moveNode(node)
//=================================================
{
	var ok = false
	//-----------------------------------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceVariable(test);
		test = replaceBatchVariable(getTest(test),node);
	}
	//------------------------------------
	var source = $("source",node).text();
	var srce_idx = source.lastIndexOf(".");
	var srce_treeref = source.substring(0,srce_idx);
	var srce_semtag = source.substring(srce_idx+1);
	//------------------------------------
	var select = $(node).attr("select");
	var dest_idx = select.lastIndexOf(".");
	var dest_treeref = select.substring(0,dest_idx);
	var dest_semtag = select.substring(dest_idx+1);
	//------------- source -----------------------
	var nodeid = "";
	if (source.indexOf('#current_node')+source.indexOf('#uuid')>-2){
		if (source.indexOf('#current_node')>-1)
			nodeid = g_current_node_uuid;
		else
			nodeid = replaceVariable(b_replaceVariable(treeref)); // select = porfolio_uuid.#uuid
	} else {
		//------------  --------------------
		var url = "";
		if (srce_treeref.indexOf("#")>-1)
			url = serverBCK_API+"/nodes?portfoliocode=" + srce_treeref.substring(1) + "&semtag="+srce_semtag;	
		else
			url = serverBCK_API+"/nodes?portfoliocode=" + g_trees[srce_treeref][1] + "&semtag="+srce_semtag;
		//--------------------------------
		$.ajax({
			async: false,
			type : "GET",
			dataType : "xml",
			url : url,
			success : function(data) {
				var nodes = $("node",data);
				if (test!=undefined)
					nodes = eval("$(nodes)"+test);
				if (nodes.length>0){
					nodeid = $(nodes[0]).attr('id');
				} else {
					$("#batch-log").append("<br>- <span class='danger'>ERROR </span> in move NOT FOUND - source="+source);
				}
			},
			error : function(data) {
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in move - source="+source);
			}
		});
	}
	//------------ Target --------------------
	if (select.indexOf('#current_node')+select.indexOf('#uuid')>-2){
		if (select.indexOf('#current_node')>-1)
			destid = g_current_node_uuid;
		else
			destid = replaceVariable(b_replaceVariable(treeref)); // select = porfolio_uuid.#uuid
	} else {
		var url = "";
		if (dest_treeref.indexOf("#")>-1)
			url = serverBCK_API+"/nodes?portfoliocode=" + dest_treeref.substring(1) + "&semtag="+dest_semtag;	
		else
			url = serverBCK_API+"/nodes?portfoliocode=" + g_trees[dest_treeref][1] + "&semtag="+dest_semtag;
		//--------------------------------
		$.ajax({
			async: false,
			type : "GET",
			dataType : "xml",
			url : url,
			success : function(data) {
				var nodes = $("node",data);
				if (test!=undefined)
					nodes = eval("$(nodes)"+test);
				if (nodes.length>0){
					destid = $(nodes[0]).attr('id');
				} else {
					$("#batch-log").append("<br>- <span class='danger'>ERROR</span> NOT FOUND - dest="+select);
				}
			},
			error : function(data) {
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in move NOT FOUND - dest="+select);
			}
		});
		//----------------- move node ------------------------
		$.ajax({
			async:false,
			type : "POST",
			dataType : "text",
			url : serverBCK_API+"/nodes/node/" + nodeid + "/parentof/"+destid,
			success : function(data) {
				$("#batch-log").append("<br>- node moved from -"+source+ " to "+select);
			},
			error : function(jqxhr,textStatus) {
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in move from -"+source+ " to "+select);
			}
		});

	}
	return ok;
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ Delete Node ----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['delete-node'] = function deleteNode(node)
//=================================================
{
	var ok = 0;
	//----------Test --------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceVariable(test);
		test = replaceBatchVariable(getTest(test),node);
	}
	var filter_semtag = $(node).attr("filter-semtag");
	var filter_test = $(node).attr("filter-test");
	if (filter_test!=undefined) {
		filter_test = replaceVariable(filter_test);
		filter_test=getTest(filter_test);
	}
	//------------ Target --------------------
	var url = getTargetUrl(node);
	//--------------------------------
	var temp_nodes = new Array();
	var temp1_nodes = new Array();
	var nodes = new Array();
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				temp_nodes[0] = results[0];
			} else {							// get by code and semtag
				temp_nodes = $("node",data);
			}
			if (test!=undefined)
				temp_nodes = eval("$(temp_nodes)"+test);
			//-------------------
			if (filter_semtag!=undefined && filter_semtag!="") {
				for (let i=0;i<temp_nodes.length;i++){
					var nodeid = $(temp_nodes[i]).attr('id');
					$.ajax({
						async : false,
						type : "GET",
						dataType : "xml",
						url : serverBCK_API+"/nodes/node/"+nodeid,
						success : function(data) {
							var nds = $("*:has(>metadata[semantictag="+filter_semtag+"])",data);
							if (filter_test!=undefined && filter_test!="")
								nds = eval("$(nds)"+filter_test);
							temp1_nodes = temp1_nodes.concat(nds);
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - update-resource "+type+"</span>");
						}
					});
				}
				nodes = temp1_nodes;
			} else {
				nodes = temp_nodes;
			}
			//-------------------------
			for (i=0; i<nodes.length; i++){
				var nodeid = $(nodes[i]).attr('id');
				$.ajax({
					async : false,
					type : "DELETE",
					dataType : "text",
					url : serverBCK_API+"/nodes/node/" + nodeid,
					nodeid : nodeid,
					success : function(data) {
						ok = true;
						$("#batch-log").append("<br>- node deleted ("+this.nodeid+")");
					},
					error : function(data) {
						$("#batch-log").append("<br>- *** <span class='danger'>ERROR</span> in deleting node : "+this.nodeid);
					}
				});
			}
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR</span>");
		}
	});
	return (ok!=0 && ok == nodes.length);
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Moveup Node ---------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['moveup-node'] = function moveupNode(node)
//=================================================
{
	var ok = 0;
	//----------Test --------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceVariable(test);
		test=getTest(test);
	}
	var filter_semtag = $(node).attr("filter-semtag");
	var filter_test = $(node).attr("filter-test");
	if (filter_test!=undefined) {
		filter_test = replaceVariable(filter_test);
		filter_test=getTest(filter_test);
	}
	//------------ Target --------------------
	var url = getTargetUrl(node);
	var semtag = getSemtag(node);
	//--------------------------------
	var temp_nodes = new Array();
	var temp1_nodes = new Array();
	var nodes = new Array();
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				temp_nodes[0] = results[0];
			} else {							// get by code and semtag
				temp_nodes = $("node",data);
			}
			if (test!=undefined)
				temp_nodes = eval("$(temp_nodes)"+test);
			//-------------------
			if (filter_semtag!=undefined && filter_semtag!="") {
				for (let i=0;i<temp_nodes.length;i++){
					var nodeid = $(temp_nodes[i]).attr('id');
					$.ajax({
						async : false,
						type : "GET",
						dataType : "xml",
						url : serverBCK_API+"/nodes/node/"+nodeid,
						success : function(data) {
							var nds = $("*:has(>metadata[semantictag="+filter_semtag+"])",data);
							if (filter_test!=undefined && filter_test!="")
								nds = eval("$(nds)"+filter_test);
							temp1_nodes = temp1_nodes.concat(nds);
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR -  "+nodeid+"("+this.semtag+")</span>");
						}
					});
				}
				nodes = temp1_nodes;
			} else {
				nodes = temp_nodes;
			}
			//-------------------
			for (i=0; i<nodes.length; i++){
				var nodeid = $(nodes[i]).attr('id');
				$.ajax({
					async : false,
					type : "POST",
					dataType : "text",
					semtag:semtag,
					url : serverBCK_API+"/nodes/node/" + nodeid + "/moveup",
					success : function(data) {
						ok++;
						$("#batch-log").append("<br>- node moved up - nodeid("+this.semtag+")");
					},
					error : function(jqxhr,textStatus) {
						$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in moveup node - "+nodeid+"("+this.semtag+")");
					}
				});
			}
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR</span> in update-moveup "+this.semtag);
		}
	});
	return (ok!=0 && ok == nodes.length);
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- Submitall -----------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['submitall'] = function submitall(node)
//=================================================
{
	var ok = 0;
	var type = $(node).attr("type");
	//----------Test --------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceBatchVariable(test);
		test=getTest(test);
	}
	var filter_semtag = $(node).attr("filter-semtag");
	var filter_test = $(node).attr("filter-test");
	if (filter_test!=undefined) {
		filter_test = replaceBatchVariable(filter_test);
		filter_test=getTest(filter_test);
	}
	//------------ Target --------------------
	var url = getTargetUrl(node);
	//--------------------------------
	var nodes = new Array();
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				nodes[0] = results[0];
			} else {							// get by code and semtag
				nodes = $("node",data);
			}
			nodes = eval("$(nodes)"+test);
			if (nodes.length>0){
				for (var i=0; i<nodes.length; i++){
					//-------------------
					var nodeid = $(nodes[i]).attr('id');
				//-------------------
					$.ajax({
						async : false,
						type : "POST",
						contentType: "application/xml",
						dataType : "text",
						url : serverBCK_API+"/nodes/node/" + nodeid + "/action/submitall",
						success : function(data) {
							ok++;
							$("#batch-log").append("<br>- node submitted ("+nodeid+")");
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in submitall("+nodeid+")");
						}
					});
					//-------------------
				}
			} else {
				$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - submitall</span>");
			}
		},
		error : function(data) {
				$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - submitall</span>");
		}
	});
	return (ok!=0 && ok == nodes.length);
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- UPDATE-PROXY --------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['update-proxy'] = function update_proxy(node)
//=================================================
{
	var ok = 0;
	//------------ Source --------------------
	var srce_url = getSourceUrl(node);
	var sources = new Array();
	var sourceid = "";
	if (srce_url!="") {
		$.ajax({
			async : false,
			type : "GET",
			dataType : "xml",
			url : srce_url,
			success : function(data) {
				if (this.url.indexOf('/node/')>-1) {  // get by uuid
					var results = $('*',data);
					sources[0] = results[0];
				} else {							// get by code and semtag
					sources = $("node",data);
				}
				sourceid = $(sources[0]).attr('id');
			},
			error : function() {
				$("#batch-log").append("<br>- ***SOURCE NOT FOUND <span class='danger'>ERROR</span>");
			}
		});
	}
	//------------ Target --------------------
	var target_url = getTargetUrl(node);
	var nodes = new Array();
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : target_url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				nodes[0] = results[0];
			} else {							// get by code and semtag
				nodes = $("node",data);
			}
			for (i=0; i<nodes.length; i++){
				ok++;
				var targetid = $(nodes[i]).attr('id');
				//----- get target ----------------
				var resource = $("asmResource[xsi_type='Proxy']",nodes[i]);
				$("code",resource).text(sourceid);
				$("value",resource).text(sourceid);
				var xml = "<asmResource xsi_type='Proxy'>" + $(resource).html() + "</asmResource>";
				var strippeddata = xml.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
				//----- update target ----------------
				$.ajax({
					async : false,
					type : "PUT",
					contentType: "application/xml",
					dataType : "text",
					data : strippeddata,
					targetid : targetid,
					sourceid : sourceid,
					url : serverBCK_API+"/resources/resource/" + targetid,
					success : function(data) {
						ok++;
						$("#batch-log").append("<br>- resource updated target : "+this.targetid+" - srce: "+this.sourceid);
						//===========================================================
					},
					error : function(data) {
						$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update resource");
					}
				});
			}
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***TARGET NOT FOUND <span class='danger'>ERROR</span> ");
		}
	});
	return (ok!=0 && ok == nodes.length);
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- UPDATE-URL2UNIT -----------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['update-url2unit'] = function update_url2unit(node)
//=================================================
{
	var ok = 0;
	//------------ Source --------------------
	var srce_url = getSourceUrl(node);
	var sources = new Array();
	var sourceid = "";
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : srce_url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				sources[0] = results[0];
			} else {							// get by code and semtag
				sources = $("node",data);
			}
			sourceid = $(sources[0]).attr('id');
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***SOURCE NOT FOUND <span class='danger'>ERROR</span>");
		}
	});
	//------------ Target --------------------
	var target_url = getTargetUrl(node);
	var nodes = new Array();
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : target_url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				nodes[0] = results[0];
			} else {							// get by code and semtag
				nodes = $("node",data);
			}
			for (i=0; i<nodes.length; i++){
				ok++;
				var targetid = $(nodes[i]).attr('id');
				//----- get target ----------------
				var resource = $("asmResource[xsi_type='URL2Unit']",nodes[i]);
				$("uuid",resource).text(sourceid);
				var xml = "<asmResource xsi_type='URL2Unit'>" + $(resource).html() + "</asmResource>";
				var strippeddata = xml.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
				//----- update target ----------------
				$.ajax({
					async : false,
					type : "PUT",
					contentType: "application/xml",
					dataType : "text",
					data : xml,
					targetid : targetid,
					sourceid : sourceid,
					url : serverBCK_API+"/resources/resource/" + targetid,
					success : function(data) {
						ok++;
						$("#batch-log").append("<br>- URL2Unit updated target : "+this.targetid+" - srce: "+this.sourceid);
						//===========================================================
					},
					error : function(data) {
						$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update url2unit");
					}
				});
			}
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***TARGET NOT FOUND <span class='danger'>ERROR</span> ");
		}
	});
	return (ok!=0 && ok == nodes.length);
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------- UPDATE-URL2PORTFOLIO ------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['update-url2portfolio'] = function update_url2portfolio(node)
//=================================================
{
	var ok = 0;
	//------------ Source --------------------
	var treeref = $("source",node).attr("select");
	var sourceid = "";
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : serverBCK_API+"/nodes?portfoliocode=" + g_trees[treeref][1] + "&semtag=root",
		success : function(data) {
			sourceid = $("asmRoot",data).attr('id');
		}
	});
	//------------ Target --------------------
	var target_url = getTargetUrl(node);
	var nodes = new Array();
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : target_url,
		success : function(data) {
			if (this.url.indexOf('/node/')>-1) {  // get by uuid
				var results = $('*',data);
				nodes[0] = results[0];
			} else {							// get by code and semtag
				nodes = $("node",data);
			}
			for (i=0; i<nodes.length; i++){
				ok++;
				var targetid = $(nodes[i]).attr('id');
				//----- get target ----------------
				var resource = $("asmResource[xsi_type='URL2Portfolio']",nodes[i]);
				$("uuid",resource).text(sourceid);
				var xml = "<asmResource xsi_type='URL2Portfolio'>" + $(resource).html() + "</asmResource>";
				var strippeddata = xml.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
				//----- update target ----------------
				$.ajax({
					async : false,
					type : "PUT",
					contentType: "application/xml",
					dataType : "text",
					data : xml,
					targetid : targetid,
					sourceid : sourceid,
					url : serverBCK_API+"/resources/resource/" + targetid,
					success : function(data) {
						ok++;
						$("#batch-log").append("<br>- URL2Portfolio updated target : "+this.targetid+" - srce: "+this.sourceid);
						//===========================================================
					},
					error : function(data) {
						$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update url2unit");
					}
				});
			}
		},
		error : function(data) {
			$("#batch-log").append("<br>- ***TARGET NOT FOUND <span class='danger'>ERROR</span> ");
		}
	});
	return (ok!=0 && ok == nodes.length);
}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ Batch - Test ---------------------------------
//-----------------------------------------------------------------------
//-----------------------------------------------------------------------

//=================================================
g_actions['test'] = function (node)
//=================================================
{
	var ok = false;
	var test = $(node).attr("toeval");
	try {
		test = replaceVariable(replaceBatchVariable(test));
		ok = eval(test);
	}
	catch(err) {
		ok = false;
	}
	return ok;
}

//=============================================================================
//=============================================================================
//====================== Variable =============================================
//=============================================================================
//=============================================================================

//==================================
g_actions['variable'] = function (node)
//==================================
{
	var ok = false
	//-----------------------------------
	var text = "";
	var varlabel = $(node).attr("varlabel");
	//-----------------------------------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceVariable(test);
		test = replaceBatchVariable(getTest(test),node);
	}
	//------------------------------------
	var source = $("source",node).text();
	var srce_idx = source.lastIndexOf(".");
	var srce_treeref = source.substring(0,srce_idx);
	var srce_semtag = source.substring(srce_idx+1);
	//------------- source -----------------------
	var nodeid = "";
	if (source.indexOf('#current_node')+source.indexOf('#uuid')>-2){
		if (source.indexOf('#current_node')>-1)
			nodeid = g_current_node_uuid;
		else
			nodeid = replaceVariable(b_replaceVariable(treeref)); // select = porfolio_uuid.#uuid
	} else {
		//------------  --------------------
		var url = "";
		if (srce_treeref.indexOf("#")>-1)
			url = serverBCK_API+"/nodes?portfoliocode=" + srce_treeref.substring(1) + "&semtag="+srce_semtag;	
		else
			url = serverBCK_API+"/nodes?portfoliocode=" + g_trees[srce_treeref][1] + "&semtag="+srce_semtag;
		//--------------------------------
		var nodes ='';
		$.ajax({
			async: false,
			type : "GET",
			dataType : "xml",
			url : url,
			success : function(data) {
				nodes = $("node",data);
				UICom.parseStructure(data,false);
				if (test!=undefined)
					nodes = eval("$(nodes)"+test);
				if (nodes.length>0){
					nodeid = $(nodes[0]).attr('id');
				} else {
					//$("#batch-log").append("<br>- <span class='danger'>ERROR </span> in move NOT FOUND - source="+source);
				}
			},
			error : function(data) {
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in variable - source="+source);
			}
		});
	}
	//---------- node-resource -----------
	//------------------------------------
	const select = $(node).attr("select");
	if (select!=undefined && select.length>0) {
		//---------- node-resource -----------
		if (select=='resource') {
			text = UICom.structure["ui"][nodeid].resource.getView("dashboard_"+nodeid,null,null,true);
			
		}
		else if (select=='resource code') {
			text = UICom.structure["ui"][nodeid].resource.getCode();
		}
		else if (select=='resource value') {
			text = UICom.structure["ui"][nodeid].resource.getValue("dashboard_value_"+nodeid);
			prefix_id += "value_";
		}
		else if (select=='resource label') {
			text = UICom.structure["ui"][nodeid].resource.getLabel();
		}
		else if (select=='node label') {
			text = UICom.structure["ui"][nodeid].getLabel();
		}
		else if (select=='node code') {
			text = UICom.structure["ui"][nodeid].getCode();
		}
		else if (select=='node value') {
			text = UICom.structure["ui"][nodeid].getValue();
		}
		else if (select=='resourcelastmodified') {
			text = new Date(parseInt(UICom.structure["ui"][nodeid].resource.lastmodified_node.text())).toLocaleString();
		}
		else if (select=='nodelastmodified') {
			text = new Date(parseInt(UICom.structure["ui"][nodeid].lastmodified_node.text())).toLocaleString();
		}
		else if (select=='uuid') {
			text = nodeid;
		}
		else if (select=='node context') {
			text = UICom.structure["ui"][nodeid].getContext("dashboard_context_"+nodeid);
			prefix_id += "context_";
		}
	}
	//------------------------------
	$("#batch-log").append("<br>- Variable " + varlabel + " = " + text );
	g_variables[varlabel] = text;
}

//=============================================================================
//=============================================================================
//====================== FOR-EACH-NODE ========================================
//=============================================================================
//=============================================================================

//==================================
g_actions['for-each-node'] = function (node)
//==================================
{
	var ok = false
	//-----------------------------------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceVariable(test);
		test = replaceBatchVariable(getTest(test),node);
	}
	//------------------------------------
	var source = $(node).attr("source");
	var srce_idx = source.lastIndexOf(".");
	var srce_treeref = source.substring(0,srce_idx);
	var srce_semtag = source.substring(srce_idx+1);
	//------------- source -----------------------
	if (source.indexOf('#current_node')+source.indexOf('#uuid')>-2){
		if (source.indexOf('#current_node')>-1)
			nodeid = g_current_node_uuid;
		else
			nodeid = replaceVariable(b_replaceVariable(treeref)); // select = porfolio_uuid.#uuid
	} else {
		//------------  --------------------
		var url = "";
		if (srce_treeref.indexOf("#")>-1)
			url = serverBCK_API+"/nodes?portfoliocode=" + srce_treeref.substring(1) + "&semtag="+srce_semtag;	
		else
			url = serverBCK_API+"/nodes?portfoliocode=" + g_trees[srce_treeref][1] + "&semtag="+srce_semtag;
		//--------------------------------
		$.ajax({
			async: false,
			type : "GET",
			dataType : "xml",
			url : url,
			success : function(data) {
				UICom.parseStructure(data,false);
				let nodes = $("node",data);
				UICom.parseStructure(data,false);
				if (test!=undefined)
					nodes = eval("$(nodes)"+test);
				$("#batch-log").append("<br>" + nodes.length + " nodes");
				let actions = $(node).children();
				$("#batch-log").append("<br>Actions : ");
				for (let j=0; j<actions.length;j++){
					$("#batch-log").append($(actions[j])[0].tagName+" / ");
				}
				for (let i=0; i<nodes.length; i++){
					const nodeid = $(nodes[i]).attr('id');
					$.ajax({
						async : false,
						type : "GET",
						dataType : "xml",
						url : serverBCK_API+"/nodes/node/"+nodeid,
						success : function(data) {
							for (let j=0; j<actions.length;j++){
								var tagname = $(actions[j])[0].tagName;
								g_actions[tagname](actions[j],data);
							}
						},
						error : function(data) {
							$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - for-each-node "+srce_semtag+"</span>");
						}
					});
					
				}
			},
			error : function() {
				$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in for-each-node - source="+source);
			}
		});
	}
}

//==================================
g_actions['fen-batch-variable'] = function (node,data)
//==================================
{
	var ok = false
	//-----------------------------------
	var text = "";
	var varlabel = $(node).attr("varlabel");
	//-----------------------------------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceVariable(test);
		test = replaceBatchVariable(getTest(test),node);
	}
	//------------------------------------
	var semtag = $(node).attr("semtag");
	const nodes = $("*:has(>metadata[semantictag*='"+semtag+"'])",data)
	const nodeid = $(nodes[0]).attr('id');
	//---------- node-resource -----------
	//------------------------------------
	const select = $(node).attr("select");
	if (select!=undefined && select.length>0) {
		//---------- node-resource -----------
		if (select=='resource') {
			text = UICom.structure["ui"][nodeid].resource.getView("dashboard_"+nodeid,null,null,true);
			
		}
		else if (select=='resource code') {
			text = UICom.structure["ui"][nodeid].resource.getCode();
		}
		else if (select=='resource value') {
			text = UICom.structure["ui"][nodeid].resource.getValue("dashboard_value_"+nodeid);
			prefix_id += "value_";
		}
		else if (select=='resource label') {
			text = UICom.structure["ui"][nodeid].resource.getLabel();
		}
		else if (select=='node label') {
			text = UICom.structure["ui"][nodeid].getLabel();
		}
		else if (select=='node code') {
			text = UICom.structure["ui"][nodeid].getCode();
		}
		else if (select=='node value') {
			text = UICom.structure["ui"][nodeid].getValue();
		}
		else if (select=='resourcelastmodified') {
			text = new Date(parseInt(UICom.structure["ui"][nodeid].resource.lastmodified_node.text())).toLocaleString();
		}
		else if (select=='nodelastmodified') {
			text = new Date(parseInt(UICom.structure["ui"][nodeid].lastmodified_node.text())).toLocaleString();
		}
		else if (select=='uuid') {
			text = nodeid;
		}
		else if (select=='node context') {
			text = UICom.structure["ui"][nodeid].getContext("dashboard_context_"+nodeid);
			prefix_id += "context_";
		}
	}
	//------------------------------
	$("#batch-log").append("<br>- Variable " + varlabel + " = " + text );
	g_variables[varlabel] = text;
}

//=================================================
g_actions['fen-update-resource'] = function updateResource(node,data)
//=================================================
{
	var ok = 0;
	var type = $(node).attr("type");
	var attributes = $("attribute",node)
	var semtag = $(node).attr("semtag");
	//----------Test --------
	var test = $(node).attr("test");
	if (test!=undefined) {
		test = replaceBatchVariable(test);
		test=getTest(test);
	}
	var filter_semtag = $(node).attr("filter-semtag");
	var filter_test = $(node).attr("filter-test");
	if (filter_test!=undefined) {
		filter_test = replaceBatchVariable(filter_test);
		filter_test=getTest(filter_test);
	}
	//--------------------------------
	let nodes = $("*:has(>metadata[semantictag*='"+semtag+"'])",data).addBack("*:has(>metadata[semantictag*='"+semtag+"'])");
	//-------------------
	if (nodes.length>0){
		for (var i=0; i<nodes.length; i++){
			//-------------------
			var nodeid = $(nodes[i]).attr('id');
			var resource = $("asmResource[xsi_type='"+type+"']",nodes[i]);
			for (var j=0; j<attributes.length; j++){
				var attribute_name = $(attributes[j]).attr("name");
				var language_dependent = $(attributes[j]).attr("language-dependent");
				var replace_variable = $(attributes[j]).attr("replace-variable");
				var attribute_value = "";
				if (replace_variable=='Y')
					attribute_value = getTxtvals($("attribute[name='"+attribute_name+"']",node));
				else
					attribute_value = getTxtvalsWithoutReplacement($("attribute[name='"+attribute_name+"']",node));
				if (language_dependent=='Y')
					$(attribute_name+"[lang='"+LANG+"']",resource).text(attribute_value);
				else
					$(attribute_name,resource).text(attribute_value);
			}
			var data = "<asmResource xsi_type='"+type+"'>" + $(resource).html() + "</asmResource>";
			var strippeddata = data.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
			//-------------------
			$.ajax({
				async : false,
				type : "PUT",
				contentType: "application/xml",
				dataType : "text",
				data : strippeddata,
				url : serverBCK_API+"/resources/resource/" + nodeid,
				success : function(data) {
					ok++;
					$("#batch-log").append("<br>- resource updated "+type+" - "+semtag+" - "+attribute_value);
				},
				error : function(data) {
					$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update resource "+type+" - "+semtag+":"+attribute_value);
				}
			});
			//-------------------
		}
	} else {
		$("#batch-log").append("<br>- ***NOT FOUND <span class='danger'>ERROR - fen-update-resource "+type+"</span>");
	}
	return (ok!=0 && ok == nodes.length);
}

//=================================================
g_actions['fen-move-node'] = function (node,data)
//=================================================
{
	var ok = false
	//-----------------------------------
	var source_test = $(node).attr("source-test");
	if (source_test!=undefined) {
		source_test = replaceVariable(source_test);
		source_test = replaceBatchVariable(getTest(source_test),node);
	}
	//------------------------------------
	var source = $(node).attr("source");
	//-----------------------------------
	var target_test = $(node).attr("target-test");
	if (target_test!=undefined) {
		target_test = replaceVariable(target_test);
		target_test = replaceBatchVariable(getTest(target_test),node);
	}
	//------------------------------------
	var target = $(node).attr("target");
	//------------- source -----------------------
	let source_nodes = $("*:has(>metadata[semantictag*='"+source+"'])",data).addBack("*:has(>metadata[semantictag*='"+source+"'])");
	if (source_test!=undefined)
		source_nodes = eval("$(source_nodes)"+source_test);
	const nodeid = $(source_nodes[0]).attr("id");
	//------------- target -----------------------
	let target_nodes = $("*:has(>metadata[semantictag*='"+target+"'])",data).addBack("*:has(>metadata[semantictag*='"+target+"'])");
	if (target_test!=undefined)
		target_nodes = eval("$(target_nodes)"+target_test);
	const destid = $(target_nodes[0]).attr("id");
	//----------------- move node ------------------------
	$.ajax({
		async:false,
		type : "POST",
		dataType : "text",
		url : serverBCK_API+"/nodes/node/" + nodeid + "/parentof/"+destid,
		success : function(data) {
			$("#batch-log").append("<br>- node moved from -"+source+ " to "+target);
			ok = true
		},
		error : function(jqxhr,textStatus) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in move from -"+source+ " to "+target);
		}
	});
	return ok;
}

//==========================================================================
//==========================================================================
//==========================================================================
//==========================================================================
//==========================================================================
//==========================================================================
//==========================================================================

//=================================================
function processCode()
//=================================================
{
	
	g_json = {};
	g_json['lines'] = [];
	g_json['lines'][0] = 'no_json';// there is no json
	var model_code = $("#batch-model_code").val();
	getModelAndProcess(model_code);
}

//=================================================
function getModelAndProcess(model_code)
//=================================================
{
	model_code = replaceVariable(model_code)
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : serverBCK_API+"/portfolios/portfolio/code/"+model_code + "?resources=true",
		success : function(data) {
			setVariables(data);
			var portfoliologcode = "";
			if ($("asmContext:has(metadata[semantictag='portfoliologcode'])",data).length>0)
				portfoliologcode = replaceVariable($("text[lang='"+LANG+"']",$("asmResource[xsi_type='Field']",$("asmContext:has(metadata[semantictag='portfoliologcode'])",data))).text());
			var nodeid = $("asmRoot",data).attr("id");
			// ---- transform karuta portfolio to batch model
			var urlS = serverBCK_API+"/nodes/"+nodeid+"?xsl-file="+appliname+"/karuta/xsl/karuta2batch.xsl&lang="+LANG;
			$.ajax({
				async : false,
				type : "GET",
				dataType : "xml",
				url : urlS,
				success : function(data) {
					g_xmlDoc = data;
					processAll(model_code,portfoliologcode);
				}
			 });
		}
	});
}

//==============================
function get_list_portfoliosgroups()
//==============================
{
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : serverBCK_API+"/portfoliogroups",
		data: "",
		success : function(data) {
			UIFactory["PortfoliosGroup"].parse(data);
		}
	});
}

//==============================
function get_portfoliogroupid(groupname)
//==============================
{
	var groupid = null;
	get_list_portfoliosgroups();
	for (var i=0;i<portfoliogroups_list.length;i++){
		if (portfoliogroups_list[i].code==groupname){
			groupid = portfoliogroups_list[i].id;
			break;
		}
	}
	return groupid;
}

//==============================
function get_list_usergroups()
//==============================
{
	$.ajax({
		async : false,
		type : "GET",
		dataType : "xml",
		url : serverBCK_API+"/usersgroups",
		data: "",
		success : function(data) {
			UIFactory.UsersGroup.parse(data);
		}
	});
}

//==============================
function get_usergroupid(groupname)
//==============================
{
	var groupid = null;
	get_list_usergroups();
	for (var i=0;i<usergroups_list.length;i++){
		if (usergroups_list[i].code==groupname){
			groupid = usergroups_list[i].id;
			break;
		}
	}
	return groupid;
}

//==================================================
//==================================================
//=================== BatchForm ====================
//==================================================
//==================================================

//==================================================
function execBatchForm(nodeid)
//==================================================
{
	$("#wait-window").modal('show');
	g_execbatch = false;
	let batchformnode = g_portfolio_current;
	if (nodeid!=null)
		batchformnode = $(UICom.structure.ui[nodeid].node);
	var line0 = $("asmUnitStructure:has(metadata[semantictag*='BatchFormLine0'])",batchformnode);
	var lines = $("asmUnitStructure:has(metadata[semantictag*='BatchFormLines'])",batchformnode);
	var model_code_node = $("asmContext:has(metadata[semantictag='model_code'])",batchformnode);
	var model_code_nodeid = $(model_code_node).attr("id");
	var model_code = UICom.structure["ui"][model_code_nodeid].resource.getView();
	initBatchVars();
	g_json = getInputsLine(line0);
	g_json['model_code'] = replaceVariable(model_code);
	g_json['lines'] = [];
	g_json.lines[0] = getInputsLine(lines);
	//------------------------------
	display_execBatch()
	//------------------------------
	getModelAndProcess(g_json.model_code);
	$("#wait-window").modal('hide');
};

//==================================================
function getInputsLine(node)
//==================================================
{
	let json_line = {};
	let line_inputs = $("asmContext:has(>metadata[semantictag*='BatchFormInput'])",node);
	for ( var j = 0; j < line_inputs.length; j++) {
		let inputid = $(line_inputs[j]).attr('id');
		let variable = UICom.structure["ui"][inputid].getCode().trim();
		json_line[variable] = replaceVariable(UICom.structure["ui"][inputid].resource.getView(null,'batchform').trim());
	}
	line_inputs = $("asmContext:has(>metadata[semantictag*='BatchFormInputCode'])",node);
	for ( var j = 0; j < line_inputs.length; j++) {
		let inputid = $(line_inputs[j]).attr('id');
		let variable = UICom.structure["ui"][inputid].getCode();
		if (UICom.structure["ui"][inputid].resource.type=="Get_Resource")
			json_line[variable] = replaceVariable(UICom.structure["ui"][inputid].resource.getCode(null));
	}
	line_inputs = $("asmContext:has(>metadata[semantictag*='BatchFormInputLabelCode'])",node);
	for ( var j = 0; j < line_inputs.length; j++) {
		var inputid = $(line_inputs[j]).attr('id');
		let variable = UICom.structure["ui"][inputid].getCode();
		json_line[variable+"_code"] = replaceVariable(UICom.structure["ui"][inputid].resource.getCode(null));
		json_line[variable+"_label"] = replaceVariable(UICom.structure["ui"][inputid].resource.getView(null,'batchform').trim());
	}
	line_inputs = $("asmContext:has(>metadata[semantictag*='BatchFormInputLabelCodeValue'])",node);
	for ( var j = 0; j < line_inputs.length; j++) {
		var inputid = $(line_inputs[j]).attr('id');
		let variable = UICom.structure["ui"][inputid].getCode();
		json_line[variable+"_code"] = replaceVariable(UICom.structure["ui"][inputid].resource.getCode(null));
		json_line[variable+"_label"] = replaceVariable(UICom.structure["ui"][inputid].resource.getView(null,'batchform').trim());
		json_line[variable+"_value"] = replaceVariable(UICom.structure["ui"][inputid].resource.getValue(null,'batchform').trim());
	}
	return json_line;
};

//==================================
function display_execBatch()
//==================================
{
	$("#main-exec-batch").html('');
	//---------------------
	var js1 = "javascript:$('#edit-window').modal('hide');$('#edit-window-body').html('')";
	var footer = "<button class='btn' onclick=\""+js1+";\">"+karutaStr[LANG]['Close']+"</button>";
	$("#edit-window-footer").html($(footer));
	$("#edit-window-title").html("KARUTA - "+karutaStr[LANG]['batch']);
	$("#edit-window-type").html("");
	var html = "";
	html += "<div id='batch-log' style='margin-left:20px;margin-top:20px'></div>";
	$("#edit-window-body").html(html);
	//---------------------
	$('#edit-window').modal('show');
};

//==================================================
function execReport_BatchCSV(parentid,targetid,title,codeReport,display)
//==================================================
{
	if (display==null)
		display = true;
	csvreport = [];
	$.ajaxSetup({async: false});
	var root_node = g_portfolio_current;
	if (codeReport.indexOf("@local")>-1){
		root_node = UICom.structure["ui"][parentid].node;
		codeReport = codeReport.substring(0,codeReport.indexOf("@local"))+codeReport.substring(codeReport.indexOf("@local")+6);
	}
	codeReport = replaceVariable(codeReport);
	report_getModelAndPortfolio(codeReport,root_node,null,g_dashboard_models);
	initBatchVars();
	if (csvreport.length>1) {
		var codesLine = csvreport[0].substring(0,csvreport[0].length-1).split(csvseparator);
		g_json = convertCSVLine2json(codesLine,csvreport[1]);
//		g_json['model_code'] = codeBatch;
		if (csvreport.length>3) {
			g_json['lines'] = [];
			codesLine = csvreport[2].substring(0,csvreport[2].length-1).split(csvseparator);
			for (var i=3; i<csvreport.length;i++){
				g_json.lines[g_json.lines.length] = convertCSVLine2json(codesLine,csvreport[i]);
			}
		}
		//------------------------------
		if (display)
			display_execBatch()
		//------------------------------
		getModelAndProcess(g_json.model_code);		
		UIFactory.Node.reloadUnit();
	} else  {
		alertHTML("No report data for batch execution!");
	}
	$.ajaxSetup({async: true});
};

//==================================================
function convertCSVLine2json(codes,csvline)
//==================================================
{
	var items = csvline.split(csvseparator);
	var g_json_line = {};
	for ( var i = 0; i < codes.length; i++) {
		g_json_line[codes[i]] = items[i];
	}
	return g_json_line;
};

//=================================================
function saveLog(model_code,portfoliologcode,logtext)
//=================================================
{
	var text ="<h3>"+model_code+"</h3>"+"<h4>"+new Date().toLocaleString()+"</h4>"+logtext;
	$.ajax({
		type : "GET",
		dataType : "xml",
		url : serverBCK_API+"/portfolios/portfolio/code/"+portfoliologcode,
		success : function(data) {
			var nodeid = $("asmRoot",data).attr("id");
			// ---- import textfield ---------
			var urlS = serverBCK_API+"/nodes/node/import/"+nodeid+"?srcetag=TextField&srcecode=karuta.karuta-resources";
			$.ajax({
				async:false,
				type : "POST",
				dataType : "text",
				url : urlS,
				data : "",
				success : function(data) {
					// ---- update textfield ---------
					var uuid = data;
					$.ajax({
						type : "GET",
						dataType : "xml",
						url : serverBCK_API+"/nodes/node/" + uuid,
						success : function(data) {
						var resource = $("asmResource[xsi_type='TextField']",data);
						$("text[lang='"+LANG+"']",resource).text(text);
						var data = "<asmResource xsi_type='TextField'>" + $(resource).html() + "</asmResource>";
						var strippeddata = data.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
						//-------------------
						$.ajax({
							async : false,
							type : "PUT",
							contentType: "application/xml",
							dataType : "text",
							data : strippeddata,
							url : serverBCK_API+"/resources/resource/" + uuid,
							success : function(data) {
								$("#batch-log").append("<br>--- log saved in "+portfoliologcode+" ---");
							},
							error : function(data) {
								$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in saveLog");
							}
						});
						},
						error : function(data) {
							$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in saveLog");
						}
					});
				},
				error : function(data) {
					$("#batch-log").append("<br>- <span class='danger'>ERROR</span> in saveLog");
				}
			});
		},
		error : function(data) {
			$("#batch-log").append("<br>- <span class='danger'>ERROR</span> Portfolio log does not exist");
		}
	});

}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ EXEC BATCH AT USER CREATION ------------------
//-----------------------------------------------------------------------

//=================================================
function displayExecBatchButton()
//=================================================
{
	var html = "<div id='create-portfolio' class='alert alert-success'>"+g_execbatchbuttonlabel1[LANG]+"</div>";
	$("#main-list").html(html);
	initBatchVars();
	prepareBatch();
	getModelAndProcess(g_json.model_code);

}

//-----------------------------------------------------------------------
//-----------------------------------------------------------------------
//------------------------ for backward compatibility ------------------
//-----------------------------------------------------------------------

//=================================================
function updateDocument(nodes,node,semtag)
//=================================================
{
	if (nodes.length>0) {
		//-------------------
		var filename = $("filename",node).text();
		var size = $("size",node).text();
		var type = $("type",node).text();
		var fileid = $("fileid",node).text();
		//-------------------
		var nodeid = $(nodes[0]).attr('id');
		var resource = $("asmResource[xsi_type='Document']",nodes[0]);
		$("filename[lang='"+LANG+"']",resource).text(filename);
		$("size[lang='"+LANG+"']",resource).text(size);
		$("type[lang='"+LANG+"']",resource).text(type);
		$("fileid[lang='"+LANG+"']",resource).text(fileid);
		var data = "<asmResource xsi_type='Document'>" + $(resource).html() + "</asmResource>";
		var strippeddata = data.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
		//-------------------
		nodes = nodes.slice(1,nodes.length);
		$.ajax({
			async : false,
			type : "PUT",
			contentType: "application/xml",
			dataType : "text",
			data : strippeddata,
			url : serverBCK_API+"/resources/resource/" + nodeid,
			success : function(data) {
				$("#batch-log").append("<br>- Document resource updated ("+nodeid+") - semtag="+semtag);
				updateDocument(nodes,node,semtag);
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update Document resource("+nodeid+") - semtag="+semtag);
				updateDocument(nodes,node,semtag);
			}
		});
	}
}

//=================================================
function updateField(nodes,node,type,semtag,text)
//=================================================
{
	var ok = 0;
	for (var i=0; i<nodes.length; i++){
		//-------------------
		var nodeid = $(nodes[i]).attr('id');
		var resource = $("asmResource[xsi_type='Field']",nodes[i]);
		$("text[lang='"+LANG+"']",resource).text(text);
		var data = "<asmResource xsi_type='Field'>" + $(resource).html() + "</asmResource>";
		var strippeddata = data.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
		//-------------------
		$.ajax({
			async : false,
			type : "PUT",
			contentType: "application/xml",
			dataType : "text",
			data : strippeddata,
			url : serverBCK_API+"/resources/resource/" + nodeid,
			success : function(data) {
				ok++;
				$("#batch-log").append("<br>- resource updated ("+nodeid+") - semtag="+semtag);
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update resource("+nodeid+") - semtag="+semtag);
			}
		});
		//-------------------
	}
	return (ok!=0 && ok == nodes.length);
}

//=================================================
function updateCalendar(nodes,node,text,semtag)
//=================================================
{
	if (nodes.length>0) {
		var minViewMode = $(node).attr("minViewMode");
		var format = $(node).attr("format");
		//-------------------
		var nodeid = $(nodes[0]).attr('id');
		var resource = $("asmResource[xsi_type='Calendar']",nodes[0]);
		if (minViewMode!='')
			$("minViewMode",resource).text(minViewMode);
		if (format!='')
			$("format[lang='"+LANG+"']",resource).text(format);
		$("text[lang='"+LANG+"']",resource).text(text);
		var data = "<asmResource xsi_type='Calendar'>" + $(resource).html() + "</asmResource>";
		var strippeddata = data.replace(/xmlns=\"http:\/\/www.w3.org\/1999\/xhtml\"/g,"");  // remove xmlns attribute
		//-------------------
		nodes = nodes.slice(1,nodes.length);
		//-------------------
		$.ajax({
			async : false,
			type : "PUT",
			contentType: "application/xml",
			dataType : "text",
			data : strippeddata,
			url : serverBCK_API+"/resources/resource/" + nodeid,
			success : function(data) {
				$("#batch-log").append("<br>- calendar resource updated ("+nodeid+") - semtag="+semtag);
				updateCalendar(nodes,node,text);
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update calendar resource("+nodeid+") - semtag="+semtag);
				updateCalendar(nodes,node,text);
			}
		});
	}
}

//=================================================
function updateProxy(nodes,node,type,semtag)
//=================================================
{
	if (nodes.length>0) {
		var source_select = $("source",node).attr("select");
		var source_idx = source_select.indexOf(".");
		var source_treeref = source_select.substring(0,source_idx);
		var source_semtag = source_select.substring(source_idx+1);
		//------ search sourceid -------------------
		var sourceid = $("node",data).attr('id');
		//------ search targetid -------------------
		var targetid = $(nodes[0]).attr('id');
		nodes = nodes.slice(1,nodes.length);
		$.ajax({
			async : false,
			type : "GET",
			dataType : "xml",
			url : serverBCK_API+"/nodes?portfoliocode=" + g_trees[treeref][1] + "&semtag="+semtag,
			success : function(data) {
				targetid = $("node",data).attr('id');
				var xml = "<asmResource xsi_type='Proxy'>";
				xml += "<code>"+sourceid+"</code>";
				xml += "<value>"+sourceid+"</value>";
				xml += "</asmResource>";
				//----- update target ----------------
				$.ajax({
					async : false,
					type : "PUT",
					contentType: "application/xml",
					dataType : "text",
					data : xml,
					targetid : targetid,
					sourceid : sourceid,
					semtag : semtag,
					url : serverBCK_API+"/resources/resource/" + targetid,
					success : function(data) {
						$("#batch-log").append("<br>- resource updated ("+this.targetid+") - semtag="+this.semantictag + " - srce:"+this.sourceid);
						updateProxyResource(nodes,node,type,semtag);
						//===========================================================
					},
					error : function(data) {
						$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update resource("+targetid+") - semtag="+semtag);
						updateProxy(nodes,node,type,semtag);
					}
				});
			}
		});
	}
}


//=================================================
function updateDashboard(nodes,node,type,semtag,text)
//=================================================
{
	if (nodes.length>0) {
		var nodeid = $(nodes[0]).attr('id');
		nodes = nodes.slice(1,nodes.length);
		var xml = "<asmResource xsi_type='Dashboard'>";
		for (var lan=0; lan<languages.length;lan++)
			xml += "<text lang='"+languages[lan]+"'>"+text+"</text>";
		xml += "</asmResource>";
		$.ajax({
			async : false,
			type : "PUT",
			contentType: "application/xml",
			dataType : "text",
			data : xml,
			nodeid : nodeid,
			semtag : semtag,
			url : serverBCK_API+"/resources/resource/" + nodeid,
			success : function(data) {
				$("#batch-log").append("<br>- resource Dashboard update("+this.nodeid+") - semtag="+this.semantictag);
				updateDashboard(nodes,node,type,this.semantictag,text);
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in update Dashboard("+nodeid+") - semtag="+semtag);
				updateDashboard(nodes,node,type,this.semantictag,text);
			}
		});
	}
}

//=================================================
function updateNodeResource(nodes,node)
//=================================================
{
	if (nodes.length>0) {
		var nodeid = $(nodes[0]).attr('id');
		nodes = nodes.slice(1,nodes.length);
		var newcode = getTxtvals($("newcode",node));
		var label = getTxtvals($("label",node));
		$.ajax({
			async : false,
			type : "GET",
			dataType : "xml",
			url : serverBCK_API+"/nodes/node/" + nodeid + "?resources=true",
			nodeid : nodeid,
			success : function(data) {
				var xml = "<asmResource xsi_type='nodeRes'>";
				xml += "<code>"+newcode+"</code>";
				for (var lan=0; lan<languages.length;lan++)
					if (lan==LANGCODE && label!="")
						xml += "<label lang='"+languages[lan]+"'>"+label+"</label>";
					else
						xml += "<label lang='"+languages[lan]+"'>"+$("label[lang='"+languages[lan]+"']",$("asmResource[xsi_type='nodeRes']",data)).text()+"</label>";
				xml += "</asmResource>";
				$.ajax({
					async : false,
					type : "PUT",
					contentType: "application/xml",
					dataType : "text",
					data : xml,
					url : serverBCK_API+"/nodes/node/" + nodeid + "/noderesource",
					success : function(data) {
						$("#batch-log").append("<br>- node resource updated - newcode:"+newcode+" - Label:"+label );
						updateNodeResource(nodes,node);
					},
					error : function(data) {
						$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in  updateNodeResource - nodeid:"+nodeid+" not updated");
						updateNodeResource(nodes,node);
					}
				});
			},
			error : function(data) {
				$("#batch-log").append("<br>- ***<span class='danger'>ERROR</span> in  updateNodeResource - nodeid:"+nodeid+" not found");
				updateNodeResource(nodes,node);
			}
		});
	}
}

