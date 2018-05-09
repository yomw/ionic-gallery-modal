import { Component, ViewChild, OnInit, ElementRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ViewController, NavParams, Slides, Platform } from 'ionic-angular';
import { Photo } from '../interfaces/photo-interface';
import { Subject } from 'rxjs/Subject';
import {File} from '@ionic-native/file';
import { ToastController } from 'ionic-angular';

declare let cordova:any;
@Component({
    selector: 'gallery-modal',
    templateUrl: './gallery-modal.html',
    styleUrls: ['./gallery-modal.scss'],
})

export class GalleryModal implements OnInit {
    @ViewChild('slider') slider: Slides;
    private initialImage: any;
    public photos: Photo[];
    private sliderDisabled: boolean = false;
    private initialSlide: number = 0;
    private currentSlide: number = 0;
    private sliderLoaded: boolean = false;
    private closeIcon: string = 'arrow-back';
    private downloadIcon: string = 'download';
    private resizeTriggerer: Subject<any> = new Subject();
    private slidesDragging: boolean = false;
    private panUpDownRatio: number = 0;
    private panUpDownDeltaY: number = 0;
    private dismissed: boolean = false;
    private width: number = 0;
    private height: number = 0;

    private slidesStyle: any = {
        visibility: 'hidden',
    };
    private modalStyle: any = {
        backgroundColor: 'rgba(0, 0, 0, 1)',
    };

    private transitionDuration: string = '200ms';
    private transitionTimingFunction: string = 'cubic-bezier(0.33, 0.66, 0.66, 1)';

    constructor(private viewCtrl: ViewController, params: NavParams, private element: ElementRef, private platform: Platform, private domSanitizer: DomSanitizer,private file:File,private toastCtrl:ToastController) {
        this.photos = params.get('photos') || [];
        this.closeIcon = params.get('closeIcon') || 'arrow-back';
        this.downloadIcon = params.get('downloadIcon') || 'download';
        this.initialSlide = params.get('initialSlide') || 0;

        this.initialImage = this.photos[this.initialSlide] || {};
    }

    public ngOnInit() {
        // call resize on init
        this.resize({});
    }
    /**
     * Closes the modal (when user click on CLOSE)
     */
    public dismiss() {
        this.viewCtrl.dismiss();
    }
    public download(){
        let currentSlide = this.slider.getActiveIndex();
        let allImgs = this.photos;
        let imgToDownload = allImgs[currentSlide];
        if(imgToDownload && imgToDownload.downloadable){
            let fileName = imgToDownload.name;
            let imageLocation = imgToDownload.url;
            let root = '';
            if(this.platform.is('ios')){
                root = cordova.file.documentsDirectory;
            }else if(this.platform.is('android')){
                root = cordova.file.externalRootDirectory;
            }
            let album = imgToDownload.album;
            this.file.checkDir(root,album).then(()=>{
                let xhr = new XMLHttpRequest();
                xhr.responseType = 'blob';
                xhr.onload = (event)=>{
                    let blob = xhr.response;
                    console.log(blob);
                    this.file.writeFile(root+album,fileName,blob).then(success=>{
                        console.log(success);
                        this.showToast('Saved');
                    }).catch(error=>{
                        console.error(error);
                        this.showToast('Failed to save');
                    })
                };
                xhr.open('GET', imageLocation);
                xhr.send();
            }).catch(error=> {
                console.log("Directory not found, creating")
                this.file.createDir(root,album,false).then(()=>{
                    let xhr = new XMLHttpRequest();
                    xhr.responseType = 'blob';
                    xhr.onload = (event)=>{
                        let blob = xhr.response;
                        console.log(blob);
                        this.file.writeFile(root+album,fileName,blob).then(success=>{
                            console.log(success);
                            this.showToast('Saved');
                        }).catch(error=>{
                            console.error(error);
                            this.showToast('Failed to save');
                        })
                    };
                    xhr.open('GET', imageLocation);
                    xhr.send();

                }).catch(function(error) {
                    console.log(error);
                    this.showToast('Failed to create album');
                });
            });
        }
    }

    private showToast(msg){
        this.toastCtrl.create({
            message: msg,
            duration: 3000,
            position: 'bottom'
        }).present();
    }

    private resize(event) {
        if (this.slider)
            this.slider.update();

        this.width = this.element.nativeElement.offsetWidth;
        this.height = this.element.nativeElement.offsetHeight;

        this.resizeTriggerer.next({
            width: this.width,
            height: this.height,
        });
    }

    private orientationChange(event) {
        // TODO: See if you can remove timeout
        window.setTimeout(() => {
            this.resize(event);
        }, 150);
    }

    /**
     * When the modal has entered into view
     */
    private ionViewDidEnter() {
        this.resize(false);
        this.sliderLoaded = true;
        this.slidesStyle.visibility = 'visible';
    }

    /**
     * Disables the scroll through the slider
     *
     * @param  {Event} event
     */
    private disableScroll(event) {
        if (!this.sliderDisabled) {
            this.currentSlide = this.slider.getActiveIndex();
            this.sliderDisabled = true;
        }
    }

    /**
     * Enables the scroll through the slider
     *
     * @param  {Event} event
     */
    private enableScroll(event) {
        if (this.sliderDisabled) {
            this.slider.slideTo(this.currentSlide, 0, false);
            this.sliderDisabled = false;
        }
    }

    /**
     * Called while dragging to close modal
     *
     * @param  {Event} event
     */
    private slidesDrag(event) {
        this.slidesDragging = true;
    }

    /**
     * Called when the user pans up/down
     *
     * @param  {Hammer.Event} event
     */
    private panUpDownEvent(event) {
        event.preventDefault();

        if (this.slidesDragging || this.sliderDisabled) {
            return;
        }

        let ratio = (event.distance / (this.height / 2));
        if (ratio > 1) {
            ratio = 1;
        } else if (ratio < 0) {
            ratio = 0;
        }
        const scale = (event.deltaY < 0 ? 1 : 1 - (ratio * 0.2));
        const opacity = (event.deltaY < 0 ? 1 - (ratio * 0.5) : 1 - (ratio * 0.2));
        const backgroundOpacity = (event.deltaY < 0 ? 1 : 1 - (ratio * 0.8));

        this.panUpDownRatio = ratio;
        this.panUpDownDeltaY = event.deltaY;

        this.slidesStyle.transform = `translate(0, ${event.deltaY}px) scale(${scale})`;
        this.slidesStyle.opacity = opacity;
        this.modalStyle.backgroundColor = `rgba(0, 0, 0, ${backgroundOpacity})`;

        delete this.slidesStyle.transitionProperty;
        delete this.slidesStyle.transitionDuration;
        delete this.slidesStyle.transitionTimingFunction;
        delete this.modalStyle.transitionProperty;
        delete this.modalStyle.transitionDuration;
        delete this.modalStyle.transitionTimingFunction;
    }
    /**
     * Called when the user stopped panning up/down
     *
     * @param  {Hammer.Event} event
     */
    private panEndEvent(event) {
        this.slidesDragging = false;

        this.panUpDownRatio += event.velocityY * 30;

        if (this.panUpDownRatio >= 0.65 && this.panUpDownDeltaY > 0) {
            if (!this.dismissed) {
                this.dismiss();
            }
            this.dismissed = true;
        } else {
            this.slidesStyle.transitionProperty = 'transform';
            this.slidesStyle.transitionTimingFunction = this.transitionTimingFunction;
            this.slidesStyle.transitionDuration = this.transitionDuration;

            this.modalStyle.transitionProperty = 'background-color';
            this.modalStyle.transitionTimingFunction = this.transitionTimingFunction;
            this.modalStyle.transitionDuration = this.transitionDuration;

            this.slidesStyle.transform = 'none';
            this.slidesStyle.opacity = 1;
            this.modalStyle.backgroundColor = 'rgba(0, 0, 0, 1)';
        }
    }
}