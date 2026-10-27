package com.maricobello.rajada;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Tela inteira (atrás das barras e do recorte da câmera); o CSS usa as margens seguras.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        // Jogo em tela cheia: as barras do sistema ficam escondidas (SystemBars em
        // capacitor.config.json) e voltam por um instante com um deslize da borda.
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
