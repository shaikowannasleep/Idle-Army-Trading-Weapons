 	/**
 * super-html playable adapter
 * @help https://store.cocos.com/app/detail/3657
 * @home https://github.com/magician-f/cocos-playable-demo
 * @author https://github.com/magician-f
 */
export class super_html_playable {

    download() {
        console.log("download");
        //@ts-ignore
        window.super_html && super_html.download();
    }

    game_end() {
        console.log("game end");
        //@ts-ignore
        window.super_html && super_html.game_end();
    }

    /**
     * 是否隐藏下载按钮，意味着使用平台注入的下载按钮
     * channel : google
     */
    is_hide_download() {
        //@ts-ignore
        if (window.super_html && super_html.is_hide_download) {
            //@ts-ignore
            return super_html.is_hide_download();
        }
        return false
    }

    /**
     * 设置商店地址
     * channel : unity
     * @param url https://play.google.com/store/apps/details?id=com.unimob.idle.army
     */
    set_google_play_url(url: string) {
        //@ts-ignore
        window.super_html && (super_html.google_play_url = url);
    }

    /**
    * 设置商店地址
    * channel : unity
    * @param url https://apps.apple.com/us/app/ad-testing/id1463016906
    */
    set_app_store_url(url: string) {
        //@ts-ignore
        window.super_html && (super_html.appstore_url = url);
    }

    /**
     * 检查音频是否启用
     * channel : ironsource, applovin, etc.
     * @returns true nếu audio được bật, false nếu bị tắt
     */
    is_audio(): boolean {
        //@ts-ignore
        if (window.super_html && typeof window.super_html.is_audio === 'function') {
            //@ts-ignore
            return window.super_html.is_audio();
        }
        // Mặc định trả về true nếu không có super_html
        return true;
    }

}
export default new super_html_playable();