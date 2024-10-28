/*
20200731_01
 */
/** 判斷scroll bar是否可看到該元素 **/
function isScrolledIntoView(elem) {
	if(!elem){
		return false;
	}
	var $elem = $(elem);
	var $window = $(window);

	var docViewTop = $window.scrollTop();
	var docViewBottom = docViewTop + $window.height();

	var elemTop = $elem.offset().top;
	var elemBottom = elemTop + $elem.height();
	
	//console.log(elemBottom+","+docViewBottom);
	return ((elemBottom <= docViewBottom)/* && (elemTop >= docViewTop)*/);
}
function filterUrl(input){
    input = encodeURIComponent(input);
    var value="";
	for(i=0;i<input.length;i++){
		if(input[i].charCodeAt()>=32 && input[i].charCodeAt()<=126){
			   value = value+ input[i];	  
		}
	}
	return decodeURIComponent(value);
}

function ui203_onscroll(div_id, container_id) {//ui1903, ui203
	var rect = document.getElementById(div_id).getBoundingClientRect();
	var container = document.getElementById(container_id);
	var topInView = rect.top >= 0;
	var bottomInView = rect.bottom <= window.innerHeight;
	if (topInView && bottomInView) {
		container.style.transform = "scale(1.2)";
	}else {
		container.style.transform = "scale(1)";
	}
}
function showTitleDiv(id, isShow) {//ui1903, ui203
	if (isShow) {
		document.getElementById(id).style.display = '';
	} else {
		document.getElementById(id).style.display = 'none';
	}
}
function setMyFavorite(productId,_action, vodCategory, vodLabel){
	var wsCache = new WebStorageCache();
    if(wsCache.isSupported()){
      	   wsCache.deleteAllExpires();
    }
    wsCache.delete("fav_channel");
	action = $('.like_'+productId).hasClass('on')?'delete':'set'; 
	if(_action){
		action = _action;
	}
	try {
		$.ajax({
			type : 'POST',
			cache : false,
			url : contextPathUrl+'personal/setMyFavorite.do',
			data:{
			'action':action,
			'productId':productId,
			},
			async : true,
			success : function(response) {
				if(response.result){
					if(_action){
						if(_action=='delete'){
							$('#favorite' + response.productId).remove();
						}
					}
					if(response.action=='set'){
						$('.like_' + response.productId).addClass('on');
						if(vodCategory){
							gaEvent(vodCategory, '加入收藏', vodLabel);
						}
					}else{
						$('.like_' + response.productId).removeClass('on');
						if(vodCategory){
							gaEvent(vodCategory, '取消收藏', vodLabel);
						}
					}
				}else{
					if(response.directUrl){
						location = response.directUrl;
					}else{
						alert(response.message);
					}
				}
			},
			error : function(jqXHR, textStatus, errorThrown) {
				console.log(jqXHR+'/'+textStatus+'/'+errorThrown);
				alert('後端系統異常，請稍後再試');
			},
			beforeSend : function(jqXHR, settings) {
				loadingToggle(true);
			},
			complete : function(jqXHR, textStatus) {
				loadingToggle(true);
			}
		});
	} catch (err) {
		alert(err);
	}
}

function bindProfile(userProfileId, url){
	const queryString = window.location.search;
	const urlParams = new URLSearchParams(queryString);
	try {
		$.ajax({
			type : 'POST',
			cache : false,
			url : contextPathUrl+'api/setProfile.do',
			data:{"user_profile_id" : userProfileId,
				  "isUpdateUserProfile"	: false,
				  "others": urlParams.get('others')
			},
			async : true,
			success : function(response) {
				//console.log('bind ok');
				if(url){
					location = url;
				}else{
					location= response.others;
				}
			},
			error : function(jqXHR, textStatus, errorThrown) {
				console.log(jqXHR+'/'+textStatus+'/'+errorThrown);
				alert('後端系統異常，請稍後再試');
			}
		});
	} catch (err) {
		alert(err);
	}	
}