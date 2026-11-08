export const avatarStickers=Object.freeze({robot:'Robot',pisik:'Pişik',bayqus:'Bayquş',ayi:'Ayı',pinqvin:'Pinqvin'});
export const stickerUrl=id=>typeof id==='string'&&Object.hasOwn(avatarStickers,id)?'/community-assets/avatar-'+id+'.webp':null;
export function avatarSource({avatar,avatar_path:path}){
 if(typeof path==='string'&&path.startsWith('sticker:'))return stickerUrl(path.slice(8));
 if(path)return '/api/community/media/'+path;
 return avatar===0?stickerUrl('robot'):null;
}
