import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomePageComponent } from './home-page/home-page.component';
import { HomeCarouselComponent } from './home-carousel/home-carousel.component';
import { HomeCarouselItemComponent } from './home-carousel/home-carousel-item/home-carousel-item.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    HomePageComponent,
    HomeCarouselComponent,
    HomeCarouselItemComponent,
  ],
  imports: [CommonModule, RouterModule],
  exports: [HomePageComponent],
})
export class HomeModule {}
