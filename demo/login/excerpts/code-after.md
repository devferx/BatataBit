# After: `src/pages/login.astro` lines 20–39

The form is built from catalog components (Button, SectionTitle) and the new TextField; no values of its own.

```astro
      <form class="login__form" method="post">
        <TextField
          label="Correo electrónico"
          name="email"
          type="email"
          autocomplete="email"
          required
        />
        <TextField
          label="Contraseña"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
        <a class="login__forgot" href="#">¿Olvidaste tu contraseña?</a>
        <div class="login__action">
          <Button variant="outline" as="button" type="submit" icon="arrow-right">Ingresar</Button>
        </div>
      </form>
```
